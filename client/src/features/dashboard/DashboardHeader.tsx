import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';

export function DashboardHeader() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[80rem] items-baseline justify-between px-8 py-5">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="text-lg font-semibold">{session?.user.name}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
