import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  InsightResponse,
  MemeResponse,
  NewsResponse,
  Preferences,
  PricesResponse,
} from '../../types/api';
import { fetchInsight, fetchMeme, fetchNews, fetchPreferences, fetchPrices } from './dashboard-api';

// Each staleTime mirrors the server's TTL for the same resource. This is not decoration: the
// cache is demand-driven, so the client is what creates demand, and a browser refetching every
// few seconds would spend CoinGecko's monthly cap on bytes the server would have served from
// memory anyway (§9.1).
const PRICES_STALE_MS = 120_000;
const NEWS_STALE_MS = 600_000;

// The insight is one row per user per UTC day, so it is fresh until that day ends and no
// earlier — refetching before then can only return the identical row.
function msUntilNextUtcDay(): number {
  const now = new Date();
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

  return nextDay - now.getTime();
}

// Preferences change in exactly one place — completing onboarding — and that path already
// navigates here afterwards, so there is nothing to poll for.
export function usePreferences(): UseQueryResult<Preferences> {
  return useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences, staleTime: Infinity });
}

export function usePrices(): UseQueryResult<PricesResponse> {
  return useQuery({ queryKey: ['prices'], queryFn: fetchPrices, staleTime: PRICES_STALE_MS });
}

export function useNews(): UseQueryResult<NewsResponse> {
  return useQuery({ queryKey: ['news'], queryFn: fetchNews, staleTime: NEWS_STALE_MS });
}

export function useInsight(): UseQueryResult<InsightResponse> {
  return useQuery({
    queryKey: ['insight'],
    queryFn: fetchInsight,
    staleTime: msUntilNextUtcDay(),
  });
}

// NF2 wants a new meme on each dashboard update, so this one is deliberately not cached. The
// exclude id is part of the key: refreshing asks a different question — "any meme but that one"
// — and a key that ignored it would hand back the cached answer to the previous question.
export function useMeme(exclude: string | undefined): UseQueryResult<MemeResponse> {
  return useQuery({
    queryKey: ['meme', exclude ?? null],
    queryFn: () => fetchMeme(exclude),
    staleTime: 0,
  });
}
