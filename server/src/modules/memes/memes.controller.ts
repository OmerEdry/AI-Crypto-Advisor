import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import { toErrorDetails } from '../../middleware/validate';
import { memesQuerySchema } from './memes.schema';
import * as memesService from './memes.service';

export const getRandomMeme: RequestHandler = (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  // Parsed here rather than by a middleware: Express 5 exposes req.query through a getter with
  // no setter, so `req.query = parsed` throws, and this is the only query parameter in the
  // project — a middleware for it would have exactly one call site.
  const query = memesQuerySchema.safeParse(req.query);

  if (!query.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid query parameters', toErrorDetails(query.error));
  }

  const meme = memesService.getRandom(query.data.exclude);

  res.status(200).json({ status: 'ok', meme });
};
