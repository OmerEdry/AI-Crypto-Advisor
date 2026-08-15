import { Navigate, Outlet } from 'react-router-dom';
import { FullPageLoader } from '../../components/ui/Spinner';
import { useAuth } from '../auth/use-auth';

// Deferred from the shell step, where it would have redirected to a page that did not exist yet.
// Same three states as the other two guards, and the same reason for the first one: deciding
// before /auth/me answers would send a signed-in user somewhere on a guess.
export function OnboardingGate() {
  const { session, isResolved } = useAuth();

  if (!isResolved) {
    return <FullPageLoader />;
  }

  if (session?.hasCompletedOnboarding === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
