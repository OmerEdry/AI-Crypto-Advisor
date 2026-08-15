import type { CookieOptions, RequestHandler, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import type { LoginInput, RegisterInput } from './auth.schema';
import * as authService from './auth.service';
import { ACCESS_TOKEN_MAX_AGE_MS } from './token.service';

// ARCHITECTURE.md §7.2, attribute by attribute. httpOnly is what makes an injected script
// unable to read the session; sameSite lax is what makes a cross-site POST arrive without it.
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

// The one place a session cookie is written, so §7.5's refresh-token upgrade has a single seam.
function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
}

export const register: RequestHandler<unknown, unknown, RegisterInput> = async (req, res) => {
  const result = await authService.register(req.body);

  setSessionCookie(res, result.token);
  res.status(201).json({ user: result.user });
};

export const login: RequestHandler<unknown, unknown, LoginInput> = async (req, res) => {
  const result = await authService.login(req.body);

  setSessionCookie(res, result.token);
  res.status(200).json({ user: result.user });
};

// A browser only matches a deletion to the cookie it holds when name, path and domain agree,
// so the clear reuses the options the set used. maxAge is omitted because clearCookie supplies
// its own expiry in the past.
export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, COOKIE_OPTIONS);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  // requireAuth guarantees this, but the type does not, and a route wired without requireAuth
  // should fail closed rather than read an undefined id.
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  // hasCompletedOnboarding is a sibling of `user`, not a field inside it: it describes the
  // session's position in the flow, not the person.
  const session = await authService.getSession(req.user.id);
  res.status(200).json(session);
};
