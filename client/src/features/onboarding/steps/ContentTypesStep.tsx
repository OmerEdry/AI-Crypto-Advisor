import type { ContentType } from '../../../types/api';
import { OptionButton } from '../OptionButton';

interface ContentTypesStepProps {
  selected: ContentType[];
  onToggle: (value: ContentType) => void;
}

const OPTIONS: { value: ContentType; label: string; description: string }[] = [
  {
    value: 'MARKET_NEWS',
    label: 'Market news',
    description: 'Headlines about the assets you picked.',
  },
  { value: 'CHARTS', label: 'Charts and prices', description: 'What your assets did today.' },
  { value: 'SOCIAL', label: 'Social', description: 'An AI-written read on your watchlist.' },
  { value: 'FUN', label: 'Fun', description: 'A crypto meme, refreshed whenever you like.' },
];

export function ContentTypesStep({ selected, onToggle }: ContentTypesStepProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">What do you want to see first?</h2>
      <p className="mt-1 text-sm text-muted">
        Your dashboard is ordered by this, so the order you pick in is the order you get. Every
        section stays available either way.
      </p>

      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => {
          // The rank the user is building, shown as they build it. Without this the ordering is
          // real but invisible, and a checkbox grid reads as a set.
          const rank = selected.indexOf(option.value);

          return (
            <OptionButton
              key={option.value}
              selected={rank !== -1}
              onClick={() => onToggle(option.value)}
            >
              <span className="flex items-baseline gap-3">
                {rank !== -1 && (
                  <span className="text-sm font-semibold tabular-nums text-accent">{rank + 1}</span>
                )}
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-sm text-muted">{option.description}</span>
                </span>
              </span>
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}
