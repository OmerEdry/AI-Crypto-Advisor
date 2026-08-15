import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError } from '../../lib/api-client';
import type { ContentType, InvestorType } from '../../types/api';
import { useAuth } from '../auth/use-auth';
import { savePreferences } from './preferences-api';
import { AssetsStep } from './steps/AssetsStep';
import { ContentTypesStep } from './steps/ContentTypesStep';
import { InvestorTypeStep } from './steps/InvestorTypeStep';

const STEP_COUNT = 3;
const UNREACHABLE = 'The server could not be reached. Check your connection and try again.';

// Append on select, filter on deselect — never derived by filtering the option list, which would
// silently sort the answer by the order the options happen to be listed in. §8.1 makes
// contentTypes a ranking, so that difference is the user's first choice being demoted.
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function OnboardingPage() {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();

  // Client state, deliberately: nothing persists until the final submit, so there is no server
  // copy to cache, invalidate or reconcile against. TanStack Query models a resource that
  // exists somewhere else; this is three answers that exist nowhere yet.
  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<string[]>([]);
  const [investorType, setInvestorType] = useState<InvestorType | null>(null);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [formError, setFormError] = useState<string>();

  const mutation = useMutation({
    mutationFn: savePreferences,
    onSuccess: async () => {
      // The flag lives on /auth/me and the cache still says false, so navigating first would
      // hand the dashboard to a gate that immediately sends it back here. Refreshing before
      // moving is what closes that loop.
      await refreshSession();
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : UNREACHABLE);
    },
  });

  const canContinue =
    (step === 0 && assets.length > 0) ||
    (step === 1 && investorType !== null) ||
    (step === 2 && contentTypes.length > 0);

  function handleNext(): void {
    setFormError(undefined);

    if (step < STEP_COUNT - 1) {
      setStep(step + 1);

      return;
    }

    if (investorType !== null) {
      mutation.mutate({ assets, investorType, contentTypes });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm text-muted">
        Step {step + 1} of {STEP_COUNT}
      </p>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-surface ${index <= step ? 'bg-accent' : 'bg-surface-alt'}`}
          />
        ))}
      </div>

      <div className="mt-8">
        <Card>
          {step === 0 && (
            <AssetsStep selected={assets} onToggle={(id) => setAssets(toggle(assets, id))} />
          )}
          {step === 1 && <InvestorTypeStep selected={investorType} onSelect={setInvestorType} />}
          {step === 2 && (
            <ContentTypesStep
              selected={contentTypes}
              onToggle={(value) => setContentTypes(toggle(contentTypes, value))}
            />
          )}

          {formError !== undefined && (
            <p role="alert" className="mt-6 text-sm text-negative">
              {formError}
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            {step > 0 && (
              <div className="w-32">
                <Button onClick={() => setStep(step - 1)} disabled={mutation.isPending}>
                  Back
                </Button>
              </div>
            )}
            <div className="w-full sm:w-48 sm:flex-none">
              <Button onClick={handleNext} disabled={!canContinue || mutation.isPending}>
                {step < STEP_COUNT - 1
                  ? 'Next'
                  : mutation.isPending
                    ? 'Saving…'
                    : 'Build dashboard'}
              </Button>
            </div>
            {!canContinue && (
              <p className="text-sm text-muted">
                {step === 1 ? 'Choose one to continue.' : 'Choose at least one to continue.'}
              </p>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
