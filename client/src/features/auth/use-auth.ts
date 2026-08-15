import { createContext, useContext } from 'react';
import type { Session } from '../../types/api';
import type { LoginInput, RegisterInput } from './auth-api';

export interface AuthContextValue {
  session: Session | null;
  // The third state §10.3 is about. Not authenticated-or-not: authenticated, not, or not yet
  // known. A guard that decides during "not yet known" flashes the login page at a signed-in
  // user on every hard refresh.
  isResolved: boolean;
  login: (input: LoginInput) => Promise<Session>;
  register: (input: RegisterInput) => Promise<Session>;
  logout: () => Promise<void>;
}

// The context and its hook live apart from the provider component so that file exports only
// components — which is what keeps Vite's fast refresh working on it.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Where a signed-in visitor belongs. Written once so the redirect after signing in and the
// guard on /login cannot disagree — a new account is never onboarded, so registration lands on
// /onboarding by the same rule rather than by a second one.
export function landingPath(session: Session): string {
  return session.hasCompletedOnboarding ? '/dashboard' : '/onboarding';
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
