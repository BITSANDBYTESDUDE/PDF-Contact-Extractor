import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import { TemporaryPdfStorage } from './temporaryStorage.js';

export async function initializeUploads() {
  await mkdir(config.uploadDir, { recursive: true, mode: 0o700 });
  await chmod(config.uploadDir, 0o700);
  // Remove abandoned random upload files left by an unclean process/container shutdown.
  const entries = await readdir(config.uploadDir);
  await Promise.all(
    entries
      .filter((name) => /^[0-9a-f-]{36}\.pdf$/.test(name))
      .map(async (name) => {
        const file = path.join(config.uploadDir, name);
        const info = await stat(file);
        if (Date.now() - info.mtimeMs > config.jobTimeoutMs + 60000) await rm(file, { force: true });
      }),
  );
}
const uploader = multer({
  storage: new TemporaryPdfStorage(),
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles,
    fields: 0,
    parts: config.maxFiles,
    fieldNameSize: 100,
    headerPairs: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (
      path.extname(file.originalname).toLowerCase() !== '.pdf' ||
      !['application/pdf', 'application/octet-stream'].includes(file.mimetype)
    ) {
      return cb(
        new AppError(415, 'Only PDF files are supported. Please choose a .pdf document.', 'UNSUPPORTED_FILE'),
      );
    }
    cb(null, true);
  },
}).array('files', config.maxFiles);

export async function cleanupRequestFiles(req: Request) {
  const files = Array.isArray(req.files) ? req.files : [];
  await Promise.all(
    files
      .filter((file) => typeof file.path === 'string')
      .map((file) => rm(file.path, { force: true }).catch((e) => console.error('[upload-cleanup]', e))),
  );
}
export function uploadPdfs(req: Request, res: Response, next: NextFunction) {
  const length = Number(req.headers['content-length'] || 0);
  if (length > config.maxTotalSize + 1024 * 1024)
    return next(
      new AppError(
        413,
        `Your upload is too large. Keep the combined file size under ${Math.floor(config.maxTotalSize / 1024 / 1024)} MB.`,
      ),
    );
  req.on('aborted', () => {
    void cleanupRequestFiles(req);
  });
  uploader(req, res, (error: unknown) => {
    if (error) {
      void cleanupRequestFiles(req).finally(() => next(error));
      return;
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return next(new AppError(400, 'Choose at least one PDF to extract contacts.'));
    if (files.reduce((sum, f) => sum + f.size, 0) > config.maxTotalSize) {
      void cleanupRequestFiles(req).finally(() =>
        next(
          new AppError(
            413,
            `The combined file size exceeds ${Math.floor(config.maxTotalSize / 1024 / 1024)} MB. Upload fewer PDFs at a time.`,
          ),
        ),
      );
      return;
    }
    next();
  });
}
