import { ApiError } from '../../lib/api-client';

// The server already writes its failures with the next action in them — a rate limit says wait,
// an unreachable provider says try again — so its message is used verbatim rather than
// re-worded here into a second copy that can drift. Only the case the server never got to
// answer needs a sentence of our own.
export function sectionErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "This section didn't load — the server isn't responding. Try again in a moment.";
}
