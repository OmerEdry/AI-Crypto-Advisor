import { COIN_OPTIONS } from '../coins';
import { OptionButton } from '../OptionButton';

interface AssetsStepProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export function AssetsStep({ selected, onToggle }: AssetsStepProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Which assets are you watching?</h2>
      <p className="mt-1 text-sm text-muted">
        Prices and news are filtered to these. Pick as many as you like — you can pick one.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COIN_OPTIONS.map((coin) => (
          <OptionButton
            key={coin.id}
            selected={selected.includes(coin.id)}
            onClick={() => onToggle(coin.id)}
          >
            <span className="block font-medium">{coin.name}</span>
            <span className="block text-sm tabular-nums text-muted">{coin.symbol}</span>
          </OptionButton>
        ))}
      </div>
    </div>
  );
}
