import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../auth/use-auth';

// Placeholder for Step 15. It carries a name and a sign-out control because those are what
// prove the guard resolved a real session and that clearing the cookie sends the guard the
// other way — the sections themselves are built against the real design at Step 15.
export default function DashboardPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Card>
        <h1 className="text-xl font-semibold">Signed in as {session?.user.name}</h1>
        <p className="mt-2 text-muted">
          Your dashboard is built in a later step. Everything behind this page is ready.
        </p>
        <div className="mt-6">
          <Button onClick={() => void handleSignOut()}>Sign out</Button>
        </div>
      </Card>
    </main>
  );
}
