import type { ReactNode } from 'react';

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

// One control behind all twenty-seven options in the wizard. `aria-pressed` rather than a
// checkbox role because these are toggles that act immediately, and it is what makes the
// selected state audible as well as visible — the border alone is not an announcement.
export function OptionButton({ selected, onClick, children }: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-surface border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        selected
          ? 'border-accent bg-surface-alt text-foreground'
          : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
