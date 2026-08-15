import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute';
import RegisterPage from './features/auth/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import { OnboardingGate } from './features/onboarding/OnboardingGate';
import OnboardingPage from './features/onboarding/OnboardingPage';
import NotFoundPage from './NotFoundPage';

// ARCHITECTURE.md §10.3. `/` is nested inside ProtectedRoute rather than deciding for itself:
// a signed-out visitor is sent to /login by the guard, and a signed-in one falls through to the
// redirect below — one rule instead of two copies of it.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<OnboardingGate />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
