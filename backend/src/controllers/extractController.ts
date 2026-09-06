import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import { z } from 'zod';
import { cleanupRequestFiles } from '../middleware/upload.js';
import type { JobService } from '../services/jobService.js';
import { safeFilename } from '../utils/sanitize.js';

const jobId = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export function extractController(jobs: JobService) {
  return {
    create: async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        await Promise.all(files.map((f) => chmod(f.path, 0o600)));
        const job = jobs.create(
          files.map((file) => ({
            id: randomUUID(),
            name: safeFilename(file.originalname),
            size: file.size,
            path: file.path,
          })),
        );
        res.status(202).json({ success: true, jobId: job.id, job });
      } catch (error) {
        await cleanupRequestFiles(req);
        throw error;
      }
    },
    status: (req: Request, res: Response) =>
      res.json({ success: true, job: jobs.get(jobId.parse(req.params.id)) }),
    cancel: async (req: Request, res: Response) =>
      res.json({ success: true, job: await jobs.cancel(jobId.parse(req.params.id)) }),
    forget: async (req: Request, res: Response) => {
      await jobs.forget(jobId.parse(req.params.id));
      res.status(204).end();
    },
  };
}
