import { Navigate, Outlet } from 'react-router-dom';
import { FullPageLoader } from '../../components/ui/Spinner';
import { landingPath, useAuth } from './use-auth';

// The same rule as ProtectedRoute, inverted: §10.3 sends an authenticated visitor away from
// /login and /register. It waits for the answer for the same reason — redirecting on a guess
// is a flash in whichever direction the guess was wrong.
export function PublicOnlyRoute() {
  const { session, isResolved } = useAuth();

  if (!isResolved) {
    return <FullPageLoader />;
  }

  if (session) {
    return <Navigate to={landingPath(session)} replace />;
  }

  return <Outlet />;
}
