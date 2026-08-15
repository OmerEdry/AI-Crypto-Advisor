import { Card } from '../../components/ui/Card';

// Stub, so routes.tsx is complete and the redirect targets in this step resolve to a real page.
// Step 14 builds the quiz here, and adds the gate that sends an already-onboarded visitor to
// the dashboard.
export default function OnboardingPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <Card>
        <h1 className="text-xl font-semibold">Set up your dashboard</h1>
        <p className="mt-2 text-muted">The onboarding questions arrive in the next step.</p>
      </Card>
    </main>
  );
}
