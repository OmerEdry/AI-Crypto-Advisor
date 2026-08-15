import { useId } from 'react';

interface FieldProps {
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete: string;
}

// Label, input and message in one place so the aria wiring cannot be right on four inputs and
// forgotten on the fifth. useId keeps the label's `for` and the message's id unique even when
// two fields share a name across pages.
export function Field({ label, type, value, onChange, error, autoComplete }: FieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        // Only when there is a message: a describedby pointing at an element that is not
        // rendered reads as nothing at all to a screen reader.
        aria-describedby={error === undefined ? undefined : errorId}
        className="mt-1 w-full rounded-surface border border-border bg-surface-alt px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      />
      {error !== undefined && (
        <p id={errorId} className="mt-1 text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
