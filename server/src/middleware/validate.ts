import type { RequestHandler } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError, type ErrorDetail } from '../errors/app-error';

// §6.4's `details` shape. Exported because the one query parameter in the project is parsed in
// its controller rather than by a middleware — Express 5's `req.query` has no setter, and a
// middleware with a single call site is the abstraction CLAUDE.md §1 rules out.
export function toErrorDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

// Bodies only, for the reason above.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid request body', toErrorDetails(result.error));
    }

    // Controllers read the parsed value, never the raw one, so unknown keys are already gone
    // and every field is the type the schema promised.
    req.body = result.data;
    next();
  };
}
