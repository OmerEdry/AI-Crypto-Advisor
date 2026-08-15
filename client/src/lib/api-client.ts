import type { ErrorDetail } from '../types/api';

// `/api` is a constant of the deployment topology, not a per-environment value: the Vercel
// rewrite serves the SPA and the API from one origin (§6.2c), so production needs no variable.
// Local development is the only place the two are on different ports.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// §6.1 puts health outside /api, so the ping cannot reuse the base path. Against an absolute
// base it resolves to that origin; against the relative production default it is already right.
const HEALTH_URL = API_BASE_URL.startsWith('http')
  ? new URL('/healthz', API_BASE_URL).toString()
  : '/healthz';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ErrorDetail[];

  constructor(code: string, message: string, status: number, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toDetails(value: unknown): ErrorDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is ErrorDetail =>
      isRecord(entry) && typeof entry.path === 'string' && typeof entry.message === 'string',
  );
}

// A failed request that is not one of ours — a proxy timeout, an HTML error page — still has to
// arrive as an ApiError, or every caller needs a second failure shape to handle.
async function toApiError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => undefined);

  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    const { code, message, details } = payload.error;

    return new ApiError(
      typeof code === 'string' ? code : 'INTERNAL_ERROR',
      message,
      response.status,
      toDetails(details),
    );
  }

  return new ApiError(
    'INTERNAL_ERROR',
    'The server could not be reached. Check your connection and try again.',
    response.status,
  );
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

// Returns `unknown` on purpose. Handing back a caller-chosen generic would be an unchecked
// assertion about a payload that crossed the network; narrowing happens at the call site, where
// the expected shape is actually known.
export async function apiRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    // Without this the browser sends no cookie and every authenticated call answers 401. It is
    // the one line the whole httpOnly-cookie design depends on from this side.
    credentials: 'include',
    ...(options.body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(options.body) }),
  });

  if (!response.ok) {
    // Deliberately no redirect here: a 401 is data, and what it means is the auth context's
    // decision. Navigation buried in a fetch wrapper is control flow nobody can find.
    throw await toApiError(response);
  }

  // 204, which logout returns.
  if (response.status === 204) {
    return undefined;
  }

  const payload: unknown = await response.json();

  return payload;
}

// §9.4: wake a sleeping instance while the user is still reading the login form. Fire and
// forget by design — a failed ping means the API is still cold, which the first real request
// discovers anyway, and there is nothing here worth putting in front of someone signing in.
export function pingHealth(): void {
  void fetch(HEALTH_URL).catch(() => undefined);
}
