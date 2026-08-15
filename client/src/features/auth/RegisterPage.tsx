import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { ApiError } from '../../lib/api-client';
import {
  collectErrors,
  toFieldErrors,
  validateEmail,
  validateName,
  validateNewPassword,
  type FieldErrors,
} from './auth-form';
import { landingPath, useAuth } from './use-auth';

const UNREACHABLE = 'The server could not be reached. Check your connection and try again.';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const mutation = useMutation({
    mutationFn: register,
    // A new account has never onboarded, so landingPath sends it to /onboarding by the same
    // rule that governs every other signed-in visitor.
    onSuccess: (session) => navigate(landingPath(session), { replace: true }),
    onError: (error) => {
      if (error instanceof ApiError && error.details.length > 0) {
        setFieldErrors(toFieldErrors(error.details));

        return;
      }

      // The 409 for a taken email lands here, and its message already names the next step —
      // sign in instead — with the link to do it directly below the form.
      setFormError(error instanceof ApiError ? error.message : UNREACHABLE);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(undefined);

    const errors = collectErrors({
      name: validateName(name),
      email: validateEmail(email),
      password: validateNewPassword(password),
    });

    setFieldErrors(errors);

    if (Object.keys(errors).length === 0) {
      mutation.mutate({ name, email, password });
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <div className="w-full">
        <Card>
          <h1 className="text-xl font-semibold">Create an account</h1>
          <p className="mt-1 text-sm text-muted">
            A few questions next, then your dashboard is built from your answers.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field
              label="Name"
              type="text"
              value={name}
              onChange={setName}
              error={fieldErrors.name}
              autoComplete="name"
            />
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
              autoComplete="new-password"
            />

            {formError !== undefined && (
              <p role="alert" className="text-sm text-negative">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
