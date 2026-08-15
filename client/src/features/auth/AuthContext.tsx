import { useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '../../types/api';
import * as authApi from './auth-api';
import { AuthContext, type AuthContextValue } from './use-auth';

const SESSION_KEY = ['session'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Server state, so TanStack Query rather than useState + useEffect (CLAUDE.md §5). The window
  // focus refetch is left on deliberately: /auth/me is the one auth route outside the rate
  // limiter (§17), and a session ended in another tab should be noticed here.
  const sessionQuery = useQuery({ queryKey: SESSION_KEY, queryFn: authApi.fetchSession });

  const value = useMemo<AuthContextValue>(() => {
    // Credentials go to the server, and the session comes back from /auth/me rather than from
    // the login response: §6.1 returns only { user } there, and the redirect needs
    // hasCompletedOnboarding. fetchQuery fills the cache and returns the value in one step.
    async function loadSession(): Promise<Session> {
      const session = await queryClient.fetchQuery({
        queryKey: SESSION_KEY,
        queryFn: authApi.fetchSession,
        staleTime: 0,
      });

      if (!session) {
        throw new Error('Signed in, but the session did not load. Try again.');
      }

      return session;
    }

    return {
      session: sessionQuery.data ?? null,
      isResolved: !sessionQuery.isPending,
      login: async (input) => {
        await authApi.login(input);

        return loadSession();
      },
      register: async (input) => {
        await authApi.register(input);

        return loadSession();
      },
      // Awaited to completion, not fired and forgotten: the caller navigates on the strength of
      // the refreshed flag, so returning before the refetch lands would race the guard.
      refreshSession: async () => {
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      },
      logout: async () => {
        await authApi.logout();
        // Written straight into the cache rather than invalidated: the cookie is already gone,
        // so a refetch would only spend a round trip to be told 401.
        queryClient.setQueryData(SESSION_KEY, null);
      },
    };
  }, [queryClient, sessionQuery.data, sessionQuery.isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
