import { sign, verify, type JwtPayload } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';

// The cookie's lifetime must track the token's, so both read from this one map. Keying it by
// the type of the env value means adding a duration to config/env.ts without a millisecond
// value here is a compile error, not a cookie that outlives the credential it carries.
const LIFETIME_MS: Record<typeof env.JWT_EXPIRES_IN, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
};

const SESSION_ENDED = 'Your session has ended. Sign in again.';

export const ACCESS_TOKEN_MAX_AGE_MS = LIFETIME_MS[env.JWT_EXPIRES_IN];

// A JWT is signed, not encrypted, so anyone holding one can read this payload. It carries an
// opaque user id and nothing else — jsonwebtoken adds `iat` and `exp` itself.
export function signAccessToken(payload: { sub: string }): string {
  return sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): { sub: string } {
  let payload: string | JwtPayload;

  try {
    payload = verify(token, env.JWT_SECRET);
  } catch (error) {
    // "jwt expired" and "invalid signature" are different stories — the first is routine, the
    // second suggests someone is probing. The distinction belongs in the log, not the reply.
    logger.warn('Access token rejected', {
      reason: error instanceof Error ? error.message : String(error),
    });

    throw new AppError('UNAUTHORIZED', SESSION_ENDED);
  }

  // verify resolves to a string for a token whose payload was not JSON, and `sub` is optional
  // on JwtPayload because the claim is optional in the spec. Neither is a token we issued.
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new AppError('UNAUTHORIZED', SESSION_ENDED);
  }

  return { sub: payload.sub };
}
