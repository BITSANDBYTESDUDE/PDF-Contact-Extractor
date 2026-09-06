import type { Request } from 'express';
import type multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createWriteStream, rm } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

/** A disk-backed Multer storage engine that also cleans an interrupted upload.
 * Multer's normal completed-file rollback does not cover every disconnected stream.
 */
export class TemporaryPdfStorage implements multer.StorageEngine {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const filename = `${randomUUID()}.pdf`;
    const destination = config.uploadDir;
    const target = path.join(destination, filename);
    const output = createWriteStream(target, { flags: 'wx', mode: 0o600 });
    let settled = false;
    const abort = () =>
      output.destroy(
        new AppError(400, 'The upload was interrupted. Please select your files again.', 'UPLOAD_ABORTED'),
      );
    const detach = () => req.off('aborted', abort);
    output.once('error', (error) => {
      if (settled) return;
      settled = true;
      detach();
      file.stream.unpipe(output);
      // Wait for the descriptor to close before unlinking, including late file opens.
      const cleanup = () => rm(target, { force: true }, () => callback(error));
      if (output.closed) cleanup();
      else output.once('close', cleanup);
    });
    output.once('finish', () => {
      if (settled) return;
      if (req.aborted) {
        abort();
        return;
      }
      settled = true;
      detach();
      callback(null, { destination, filename, path: target, size: output.bytesWritten });
    });
    req.once('aborted', abort);
    file.stream.once('error', (error) => output.destroy(error));
    if (req.aborted) abort();
    else file.stream.pipe(output);
  }

  _removeFile(_req: Request, file: Express.Multer.File, callback: (error: Error | null) => void) {
    rm(file.path, { force: true }, callback);
  }
}
