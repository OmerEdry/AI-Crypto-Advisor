import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not a failure worth repeating: retrying a 401 three times with
      // backoff only delays the login page. A 5xx or a network error is worth two more attempts,
      // which is also the free tier waking up.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) {
          return false;
        }

        return failureCount < 2;
      },
    },
  },
});
