import type { ErrorDetail } from '../../types/api';

export type FieldErrors = Record<string, string>;

// §6.4's `details` array names the field each message belongs to, which is what lets a server
// error render against the input that caused it rather than as a banner above the form. First
// message per field wins — a second one for the same input has nowhere to go.
export function toFieldErrors(details: ErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};

  for (const detail of details) {
    if (!(detail.path in errors)) {
      errors[detail.path] = detail.message;
    }
  }

  return errors;
}

export function collectErrors(candidates: Record<string, string | undefined>): FieldErrors {
  return Object.fromEntries(
    Object.entries(candidates).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

// Deliberately not a copy of the server's zod schema. These catch the mistakes worth catching
// before a round trip; everything else — the 72-character ceiling, the exact email grammar —
// arrives from the server as an inline field error. Two schemas that must agree are two things
// that can drift, and only one of them guards the database.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (email.trim().length === 0) {
    return 'Enter your email address.';
  }

  return EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address.';
}

export function validateName(name: string): string | undefined {
  if (name.trim().length === 0) {
    return 'Enter your name.';
  }

  return name.trim().length < 2 ? 'Must be at least 2 characters.' : undefined;
}

// Registration mirrors the server's 8-character floor, so a new account never makes a round trip
// to be told something the form already knew.
export function validateNewPassword(password: string): string | undefined {
  if (password.length === 0) {
    return 'Choose a password.';
  }

  return password.length < 8 ? 'Must be at least 8 characters.' : undefined;
}

// Signing in checks only that something was typed, which is what the server's login schema does
// and for the reason §7.6 gives: rejecting a short password here would answer a failed sign-in
// differently depending on why it failed, and the whole point is that it never does.
export function requirePassword(password: string): string | undefined {
  return password.length === 0 ? 'Enter your password.' : undefined;
}
