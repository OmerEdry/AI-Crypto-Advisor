interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

// §6.3 asks a failed section for an actionable message and a retry control, and CLAUDE.md §5
// asks the message to say what happened and what to do next. The message is passed in rather
// than written here, because only the caller knows whether this was a rate limit — wait — or a
// transient failure — retry now.
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-surface border border-border p-6 text-center">
      <p className="text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-surface border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Try again
      </button>
    </div>
  );
}
