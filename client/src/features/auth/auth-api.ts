import { ApiError, apiRequest } from '../../lib/api-client';
import type { PublicUser, Session } from '../../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// §10.4 accepts that the hand-mirrored types can drift from the server's. These parsers are what
// makes drift loud: a renamed field fails here, with a message naming the endpoint, instead of
// rendering as `undefined` three components later.
function shapeError(endpoint: string): ApiError {
  return new ApiError(
    'INTERNAL_ERROR',
    `The server sent a response ${endpoint} could not read. Try again in a moment.`,
    500,
  );
}

function parseUser(value: unknown, endpoint: string): PublicUser {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    throw shapeError(endpoint);
  }

  return { id: value.id, email: value.email, name: value.name, createdAt: value.createdAt };
}

function parseUserResponse(payload: unknown, endpoint: string): PublicUser {
  if (!isRecord(payload)) {
    throw shapeError(endpoint);
  }

  return parseUser(payload.user, endpoint);
}

function parseSession(payload: unknown): Session {
  if (!isRecord(payload) || typeof payload.hasCompletedOnboarding !== 'boolean') {
    throw shapeError('/auth/me');
  }

  return {
    user: parseUser(payload.user, '/auth/me'),
    hasCompletedOnboarding: payload.hasCompletedOnboarding,
  };
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  return parseUserResponse(
    await apiRequest('/auth/register', { method: 'POST', body: input }),
    '/auth/register',
  );
}

export async function login(input: LoginInput): Promise<PublicUser> {
  return parseUserResponse(
    await apiRequest('/auth/login', { method: 'POST', body: input }),
    '/auth/login',
  );
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST' });
}

// A signed-out visitor is the ordinary case on first load, not an error: the 401 becomes `null`
// so it never reaches the query cache as a failure, never retries, and never logs.
export async function fetchSession(): Promise<Session | null> {
  try {
    return parseSession(await apiRequest('/auth/me'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}
