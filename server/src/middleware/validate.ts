import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError, type ErrorDetail } from '../errors/app-error';

// Bodies only. Express 5 exposes req.query through a getter with no setter, so the usual
// `req.query = parsed` shape throws at runtime — a query validator has to return its result
// some other way, and no route needs one yet.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      throw new AppError('VALIDATION_ERROR', 'Invalid request body', details);
    }

    // Controllers read the parsed value, never the raw one, so unknown keys are already gone
    // and every field is the type the schema promised.
    req.body = result.data;
    next();
  };
}
