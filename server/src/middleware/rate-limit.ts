import { rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/app-error';

const WINDOW_MS = 15 * 60_000;
const MAX_REQUESTS = 10;

// ARCHITECTURE.md §7.6, applied to register and login only — the two routes that accept a
// credential. Covering /auth/me as well would 429 a signed-in user during ordinary
// tab-switching, which the client cannot tell apart from having been signed out.
export const authRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Handing the rejection to next() keeps errorHandler the only place an error body is
  // written; the library's own default sends a plain-text 429 the client cannot parse.
  handler: (_req, _res, next) => {
    next(new AppError('RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.'));
  },
});
