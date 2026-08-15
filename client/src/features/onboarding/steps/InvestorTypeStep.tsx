import type { InvestorType } from '../../../types/api';
import { OptionButton } from '../OptionButton';

interface InvestorTypeStepProps {
  selected: InvestorType | null;
  onSelect: (value: InvestorType) => void;
}

// The descriptions say what each choice changes, because §8 makes this answer drive the tone of
// the daily insight and which price window the dashboard emphasises. An option whose effect is
// invisible is a question the user cannot answer well.
const OPTIONS: { value: InvestorType; label: string; description: string }[] = [
  {
    value: 'HODLER',
    label: 'Long-term holder',
    description: 'Thirty-day moves, and an insight written for patience.',
  },
  {
    value: 'DAY_TRADER',
    label: 'Day trader',
    description: 'Twenty-four-hour moves, and an insight written for today.',
  },
  {
    value: 'NFT_COLLECTOR',
    label: 'Collector',
    description: 'Twenty-four-hour moves, with a lean toward culture and community.',
  },
];

export function InvestorTypeStep({ selected, onSelect }: InvestorTypeStepProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">How would you describe yourself?</h2>
      <p className="mt-1 text-sm text-muted">
        This sets the time horizon your dashboard reads by. Choose one.
      </p>

      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => (
          <OptionButton
            key={option.value}
            selected={selected === option.value}
            onClick={() => onSelect(option.value)}
          >
            <span className="block font-medium">{option.label}</span>
            <span className="block text-sm text-muted">{option.description}</span>
          </OptionButton>
        ))}
      </div>
    </div>
  );
}
