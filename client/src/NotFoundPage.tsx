import { Link } from 'react-router-dom';
import { Card } from './components/ui/Card';

// Belongs to no feature, so it sits beside routes.tsx rather than inventing a folder for it.
export default function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <Card>
        <h1 className="text-xl font-semibold">That page does not exist</h1>
        <p className="mt-2 text-muted">Check the address, or go back to your dashboard.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-surface text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Go to dashboard
        </Link>
      </Card>
    </main>
  );
}
