import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent || _req.aborted) return;
  let status = 500;
  let message = 'Something went wrong on the server. Please try again shortly.';
  let code = 'SERVER_ERROR';
  if (error instanceof AppError) {
    status = error.statusCode;
    message = error.message;
    code = error.code;
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `Each PDF must be ${Math.floor(config.maxFileSize / 1024 / 1024)} MB or smaller.`
        : error.code === 'LIMIT_UNEXPECTED_FILE' ||
            error.code === 'LIMIT_FILE_COUNT' ||
            error.code === 'LIMIT_PART_COUNT'
          ? `Upload up to ${config.maxFiles} PDFs using the “files” field.`
          : 'The upload could not be accepted. Please choose your PDF files again.';
  } else if (error instanceof ZodError) {
    status = 400;
    message = 'The submitted data is invalid. Check your contacts and try again.';
    code = 'VALIDATION_ERROR';
  } else if (error?.type === 'entity.too.large') {
    status = 413;
    message = 'This request is too large. Export fewer contacts at a time.';
    code = 'REQUEST_TOO_LARGE';
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    message = 'The request contains invalid JSON.';
    code = 'INVALID_JSON';
  }
  if (status >= 500) console.error('[api]', error);
  res.status(status).json({ success: false, error: { code, message } });
};
