import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { ApiError } from '../../lib/api-client';
import {
  collectErrors,
  requirePassword,
  toFieldErrors,
  validateEmail,
  type FieldErrors,
} from './auth-form';
import { landingPath, useAuth } from './use-auth';

const UNREACHABLE = 'The server could not be reached. Check your connection and try again.';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  // useMutation rather than a hand-rolled isSubmitting flag: a form submit is an interaction
  // with server state, and `isPending` is the thing the button reads (CLAUDE.md §5).
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => navigate(landingPath(session), { replace: true }),
    onError: (error) => {
      // A 400 names its fields, so it belongs on the inputs. Everything else — the 401 for bad
      // credentials, the 429 from the rate limiter — is about the attempt as a whole, and the
      // server already phrases both with the next action in them.
      if (error instanceof ApiError && error.details.length > 0) {
        setFieldErrors(toFieldErrors(error.details));

        return;
      }

      setFormError(error instanceof ApiError ? error.message : UNREACHABLE);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(undefined);

    const errors = collectErrors({
      email: validateEmail(email),
      password: requirePassword(password),
    });

    setFieldErrors(errors);

    if (Object.keys(errors).length === 0) {
      mutation.mutate({ email, password });
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <div className="w-full">
        <Card>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back to your crypto dashboard.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={fieldErrors.email}
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
              autoComplete="current-password"
            />

            {formError !== undefined && (
              <p role="alert" className="text-sm text-negative">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-muted">
          New here?{' '}
          <Link
            to="/register"
            className="text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
