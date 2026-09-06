import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/api.js';
import { JobService } from './services/jobService.js';
import { AppError } from './utils/errors.js';

export function createApp(jobs = new JobService()) {
  const app = express();
  app.disable('x-powered-by');
  // Same-host Next.js requests are trusted; never trust arbitrary forwarded headers.
  app.set('trust proxy', config.trustProxy || 'loopback');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        if (
          !origin ||
          config.origins.includes(origin) ||
          (config.previewOrigins && /^https:\/\/[a-zA-Z0-9-]+\.e2b\.app$/.test(origin))
        )
          cb(null, true);
        else cb(new AppError(403, 'This origin is not allowed to access the API.', 'ORIGIN_NOT_ALLOWED'));
      },
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: ['Content-Disposition', 'Retry-After'],
      credentials: false,
      maxAge: 600,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', apiRouter(jobs));
  app.use((_req, _res, next) => next(new AppError(404, 'This API endpoint does not exist.', 'NOT_FOUND')));
  app.use(errorHandler);
  return { app, jobs };
}
