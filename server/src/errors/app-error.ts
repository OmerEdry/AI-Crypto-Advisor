// The taxonomy from ARCHITECTURE.md §6.4. The status lives with the code so a caller can
// never pair NOT_FOUND with 500.
const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_ERROR: 502,
  UPSTREAM_RATE_LIMITED: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];

    if (details) {
      this.details = details;
    }
  }
}
