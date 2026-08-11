import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../shared/api-error';
import multer from 'multer';

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const requestId = response.locals.requestId as string | undefined;

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid data.',
        details: error.flatten(),
        requestId,
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({
      error: {
        code: 'UPLOAD_VALIDATION_ERROR',
        message: error.code === 'LIMIT_FILE_SIZE' ? 'The image must be 8 MB or smaller.' : 'The image upload is invalid.',
        requestId,
      },
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
    return;
  }

  const postgresError = error as PostgresError;
  if (postgresError.code === '23505') {
    response.status(409).json({
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'The requested record already exists.',
        requestId,
      },
    });
    return;
  }

  logger.error({ err: error, requestId }, 'Unhandled API error');
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
      requestId,
    },
  });
};
