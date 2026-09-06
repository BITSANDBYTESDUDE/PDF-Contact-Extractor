import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { exportController } from '../controllers/exportController.js';
import { extractController } from '../controllers/extractController.js';
import { uploadPdfs } from '../middleware/upload.js';
import type { JobService } from '../services/jobService.js';

const limitMessage = {
  success: false,
  error: {
    code: 'RATE_LIMITED',
    message: 'You have made too many requests. Please wait a few minutes and try again.',
  },
};
export function apiRouter(jobs: JobService) {
  const router = Router();
  const extraction = extractController(jobs);
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: limitMessage,
  });
  const exportLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: limitMessage,
  });
  const pollingLimit = rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: limitMessage,
  });
  router.get('/health', (_req, res) =>
    res.json({
      success: true,
      status: 'ok',
      version: '1.0.0',
      limits: {
        maxFileSize: config.maxFileSize,
        maxTotalSize: config.maxTotalSize,
        maxFiles: config.maxFiles,
        maxPages: config.processing.maxPages,
      },
    }),
  );
  router.post(
    '/extract',
    uploadLimit,
    (_req, _res, next) => {
      try {
        jobs.assertCapacity();
        next();
      } catch (e) {
        next(e);
      }
    },
    uploadPdfs,
    extraction.create,
  );
  router.get('/jobs/:id', pollingLimit, extraction.status);
  router.post('/jobs/:id/cancel', pollingLimit, extraction.cancel);
  router.delete('/jobs/:id', pollingLimit, extraction.forget);
  router.post('/export', exportLimit, exportController);
  return router;
}
