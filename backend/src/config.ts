import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ALLOW_PREVIEW_ORIGINS: z.enum(['true', 'false']).optional(),
  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .min(1024)
    .max(25 * 1024 * 1024)
    .default(25 * 1024 * 1024),
  MAX_TOTAL_SIZE: z.coerce
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(100 * 1024 * 1024),
  MAX_FILES: z.coerce.number().int().min(1).max(10).default(10),
  MAX_PAGES: z.coerce.number().int().min(1).max(500).default(100),
  UPLOAD_DIR: z.string().optional(),
  JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(900000).default(300000),
  JOB_TTL_MS: z.coerce.number().int().min(60000).max(3600000).default(1800000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  MAX_QUEUED_JOBS: z.coerce.number().int().min(1).max(32).default(8),
  OCR_LANGUAGE: z
    .string()
    .regex(/^[a-z]{3}(\+[a-z]{3})*$/)
    .default('eng'),
  OCR_LANG_PATH: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  AI_PROVIDER: z.enum(['none']).default('none'),
});
const env = envSchema.parse(process.env);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const config = {
  port: env.PORT,
  production: env.NODE_ENV === 'production',
  origins: env.FRONTEND_URL.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  previewOrigins:
    env.ALLOW_PREVIEW_ORIGINS === 'true' ||
    (env.ALLOW_PREVIEW_ORIGINS === undefined && env.NODE_ENV !== 'production'),
  maxFileSize: env.MAX_FILE_SIZE,
  maxTotalSize: env.MAX_TOTAL_SIZE,
  maxFiles: env.MAX_FILES,
  uploadDir: env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : path.join(backendRoot, 'uploads'),
  jobTimeoutMs: env.JOB_TIMEOUT_MS,
  jobTtlMs: env.JOB_TTL_MS,
  concurrency: env.WORKER_CONCURRENCY,
  maxQueued: env.MAX_QUEUED_JOBS,
  trustProxy: env.TRUST_PROXY,
  processing: {
    maxPages: env.MAX_PAGES,
    maxContacts: 10000,
    ocrLanguage: env.OCR_LANGUAGE,
    ocrLangPath: env.OCR_LANG_PATH,
  },
};
