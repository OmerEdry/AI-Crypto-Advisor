import type { ContentType, InvestorType } from '@prisma/client';
import type { CoinPrice } from '../../market/providers/coingecko.provider';

// §8.2. Stored on every row so historical insights stay attributable to the prompt that produced
// them; without it, comparing two prompts after the fact is guesswork. Step 11 adds the feedback
// line and must bump this — a different prompt is a different version.
export const PROMPT_VERSION = 'v1';

export interface InsightInput {
  investorType: InvestorType;
  assets: string[];
  contentTypes: ContentType[];
  coins: CoinPrice[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// §8: the investor type decides which window is emphasised. NFT_COLLECTOR reads 24h with the
// day traders — a collector tracks moves, not multi-week trends.
const PROFILE: Record<InvestorType, { label: string; window: 'change24h' | 'change30d' }> = {
  HODLER: { label: 'Long-term holder', window: 'change30d' },
  DAY_TRADER: { label: 'Day trader', window: 'change24h' },
  NFT_COLLECTOR: { label: 'Collector', window: 'change24h' },
};

function formatPercent(value: number | null): string | undefined {
  return value === null ? undefined : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function priceSummary(coins: CoinPrice[], window: 'change24h' | 'change30d'): string | undefined {
  const parts = coins
    .map((coin) => {
      const percent = formatPercent(coin[window]);

      return percent === undefined ? undefined : `${coin.id} ${percent}`;
    })
    .filter((part): part is string => part !== undefined);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function buildInsightPrompt(input: InsightInput): LlmPrompt {
  const profile = PROFILE[input.investorType];
  const summary = priceSummary(input.coins, profile.window);
  const windowLabel = profile.window === 'change30d' ? '30d' : '24h';

  // Only the four preference-derived facts and public market data. No name, no email, no user id
  // — nothing that identifies the person behind the watchlist reaches a third party (§6.2b).
  const lines = [
    `Investor profile: ${input.investorType}`,
    `Watching: ${input.assets.join(', ')}`,
    `Prefers: ${input.contentTypes.join(', ')}`,
  ];

  if (summary !== undefined) {
    lines.push(`Recent ${windowLabel} moves: ${summary}`);
  }

  lines.push('', "Write today's insight for this investor.");

  return {
    system:
      'You are a concise crypto market assistant. You do NOT give financial advice. ' +
      '2-3 sentences, max 60 words. Never recommend buying or selling.',
    user: lines.join('\n'),
  };
}

// The degraded form of the same content, from the same input — which is why it lives beside the
// prompt rather than in the service. Deterministic: no randomness, no upstream, so it cannot
// itself fail on the day the LLM already has.
export function buildTemplateInsight(input: InsightInput): string {
  const profile = PROFILE[input.investorType];
  const summary = priceSummary(input.coins, profile.window);
  const windowLabel = profile.window === 'change30d' ? 'Over 30 days' : 'Over 24 hours';
  const watching = input.assets.join(', ');

  if (summary === undefined) {
    return (
      `${profile.label} view on ${watching}. Live prices aren't available right now, ` +
      `so there are no figures to summarise yet. Nothing here is financial advice.`
    );
  }

  return (
    `${profile.label} view on ${watching}. ${windowLabel}: ${summary}. ` +
    `Figures only — nothing here is financial advice.`
  );
}
