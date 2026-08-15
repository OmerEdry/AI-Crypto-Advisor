import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { verifyAccessToken } from '../modules/auth/token.service';

export const requireAuth: RequestHandler = (req, _res, next) => {
  // cookie-parser types its bag as Record<string, any>; annotating unknown forces the check
  // below instead of letting `any` flow into the verifier.
  const token: unknown = req.cookies[env.COOKIE_NAME];

  if (typeof token !== 'string') {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  req.user = { id: verifyAccessToken(token).sub };
  next();
};
