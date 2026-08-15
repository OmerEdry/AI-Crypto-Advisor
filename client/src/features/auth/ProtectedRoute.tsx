import { Navigate, Outlet } from 'react-router-dom';
import { FullPageLoader } from '../../components/ui/Spinner';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { session, isResolved } = useAuth();

  // The order of these three returns is the whole point. Deciding before the answer arrives is
  // what sends a signed-in user to the login page for a frame on every hard refresh.
  if (!isResolved) {
    return <FullPageLoader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
