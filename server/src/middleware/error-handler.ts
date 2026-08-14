import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../lib/logger';

// express.json rejects a malformed or oversized body before any route runs, and those are the
// caller's mistake rather than ours. Without this they would surface as INTERNAL_ERROR 500.
const BODY_ERROR_MESSAGES: Record<string, string> = {
  'entity.too.large': 'Request body is larger than the 10kb limit.',
  'entity.parse.failed': 'Request body is not valid JSON.',
};

function bodyErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return undefined;
  }

  return typeof error.type === 'string' ? BODY_ERROR_MESSAGES[error.type] : undefined;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const bodyMessage = bodyErrorMessage(error);

  if (bodyMessage !== undefined) {
    return new AppError('VALIDATION_ERROR', bodyMessage);
  }

  return new AppError('INTERNAL_ERROR', 'The request failed unexpectedly. Try again in a moment.');
}

// Express identifies error middleware by its four-argument arity, so `next` must be declared
// even though it is never called.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = toAppError(error);

  // The original message never reaches the response body; it belongs in the log.
  const context = {
    method: req.method,
    path: req.path,
    code: appError.code,
    status: appError.status,
    cause: error instanceof Error ? error.message : String(error),
  };

  if (appError.status >= 500) {
    logger.error('Request failed', {
      ...context,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    // A rejected request is not a server fault, and a stack for every 404 from a passing
    // scanner would bury the failures that matter.
    logger.warn('Request rejected', context);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  });
};
