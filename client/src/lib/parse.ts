import { ApiError } from './api-client';

// §10.4 accepts that `types/api.ts` is hand-mirrored and can drift from the server. These turn
// that drift into a failure naming the endpoint, rather than an `undefined` rendered into the
// page three components later.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function shapeError(endpoint: string): ApiError {
  return new ApiError(
    'INTERNAL_ERROR',
    `The server sent a response ${endpoint} could not read. Try again in a moment.`,
    500,
  );
}

export function asRecord(value: unknown, endpoint: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw shapeError(endpoint);
  }

  return value;
}

export function asString(value: unknown, endpoint: string): string {
  if (typeof value !== 'string') {
    throw shapeError(endpoint);
  }

  return value;
}

export function asNumber(value: unknown, endpoint: string): number {
  if (typeof value !== 'number') {
    throw shapeError(endpoint);
  }

  return value;
}

export function asNullableNumber(value: unknown, endpoint: string): number | null {
  if (value !== null && typeof value !== 'number') {
    throw shapeError(endpoint);
  }

  return value;
}

export function asArray(value: unknown, endpoint: string): unknown[] {
  if (!Array.isArray(value)) {
    throw shapeError(endpoint);
  }

  return value;
}

export function asStringArray(value: unknown, endpoint: string): string[] {
  return asArray(value, endpoint).map((entry) => asString(entry, endpoint));
}

// The three-state field is worth checking rather than trusting: it drives whether a notice
// renders, and an unknown value would silently take the `ok` branch.
export function asStatus(value: unknown, endpoint: string): 'ok' | 'degraded' | 'unavailable' {
  if (value !== 'ok' && value !== 'degraded' && value !== 'unavailable') {
    throw shapeError(endpoint);
  }

  return value;
}

export function asOptionalString(value: unknown, endpoint: string): string | undefined {
  return value === undefined ? undefined : asString(value, endpoint);
}
