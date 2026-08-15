import type { SectionType, VoteType } from '../../types/api';
import { useFeedback } from './use-feedback';

// Hand-drawn rather than an icon package: two glyphs is not worth a dependency, and this way
// the stroke weight matches the rest of the page instead of a library's house style.
function ThumbIcon({ down }: { down: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${down ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 10.5v9H4.5v-9H7Zm0 0 4-7a2 2 0 0 1 2 2v4h5.2a1.8 1.8 0 0 1 1.76 2.2l-1.3 6A1.8 1.8 0 0 1 16.9 19.5H7" />
    </svg>
  );
}

interface VoteButtonProps {
  label: string;
  down: boolean;
  active: boolean;
  onClick: () => void;
}

function VoteButton({ label, down, active, onClick }: VoteButtonProps) {
  // Active state is brightness and ground, never hue: green would collide with a rising price
  // two lines above, and amber belongs to the insight alone.
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-surface p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active ? 'bg-surface-alt text-foreground' : 'text-muted hover:text-foreground'
      }`}
    >
      <ThumbIcon down={down} />
    </button>
  );
}

export function VoteButtons({
  sectionType,
  itemRef,
  label,
}: {
  sectionType: SectionType;
  itemRef: string;
  label: string;
}) {
  const { voteFor, castVote, failedItemRef } = useFeedback();
  const current: VoteType | undefined = voteFor(sectionType, itemRef);

  return (
    <div className="flex items-center gap-1">
      {failedItemRef === itemRef && (
        <span role="alert" className="mr-1 text-xs text-negative">
          Vote didn&apos;t save
        </span>
      )}
      <VoteButton
        label={`More like ${label}`}
        down={false}
        active={current === 'UP'}
        onClick={() => castVote({ sectionType, itemRef, vote: 'UP' })}
      />
      <VoteButton
        label={`Less like ${label}`}
        down
        active={current === 'DOWN'}
        onClick={() => castVote({ sectionType, itemRef, vote: 'DOWN' })}
      />
    </div>
  );
}
