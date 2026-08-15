// Hand-mirrored from the server's response DTOs, per ARCHITECTURE.md §10.4. This is duplication
// and it can drift — a server-side rename produces no compile error here. The parsers in
// features/auth/auth-api.ts are what turn that drift into a visible failure rather than an
// `undefined` rendered into the page.
//
// Only what Steps 12 and 13 consume. The four section DTOs arrive at Step 15, with their readers.

// `createdAt` is a string, not a Date: JSON has no date type, and the server's Date serialises
// to an ISO string on the way out.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// §17: `hasCompletedOnboarding` is a sibling of `user`, not a field inside it — it describes
// where the session sits in the flow, not the person.
export interface Session {
  user: PublicUser;
  hasCompletedOnboarding: boolean;
}

// §6.4. `details` is present on validation failures only, and each entry names the field it
// belongs to, which is what lets a form render a server error against the right input.
export interface ErrorDetail {
  path: string;
  message: string;
}

// The two Prisma enums, mirrored as string unions. §8: investorType picks the tone and the
// price window, contentTypes ranks the dashboard sections.
export type InvestorType = 'HODLER' | 'DAY_TRADER' | 'NFT_COLLECTOR';
export type ContentType = 'MARKET_NEWS' | 'CHARTS' | 'SOCIAL' | 'FUN';

// `contentTypes` is a ranking, not a set: §8.1 orders dashboard sections by it, and the server
// dedupes preserving first occurrence for the same reason. Whatever builds this array must
// preserve the order the user chose in.
export interface PreferencesInput {
  assets: string[];
  investorType: InvestorType;
  contentTypes: ContentType[];
}

export interface Preferences extends PreferencesInput {
  updatedAt: string;
}

// §6.3. `degraded` means something was served but not the real thing, and it arrives inside a
// 200 because the request succeeded — the payload is simply not ideal, which is information the
// client needs rather than an error condition.
export type SectionStatus = 'ok' | 'degraded' | 'unavailable';

// Both change windows are nullable: a coin without enough history returns null (§17).
export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number | null;
  change30d: number | null;
}

export interface PricesResponse {
  status: SectionStatus;
  coins: CoinPrice[];
  cachedAt: string | null;
  notice?: string;
}

// `itemRef` is `{provider}:{providerId}` per §4.3, and it is what a vote on this article
// attaches to.
export interface NewsArticle {
  itemRef: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  assets: string[];
}

export interface NewsResponse {
  status: SectionStatus;
  articles: NewsArticle[];
  provider: string;
  cachedAt: string;
  notice?: string;
}

// `id` is here because §4.3 makes it the itemRef for an INSIGHT vote — without it the vote has
// nothing to attach to (§17).
export interface Insight {
  id: string;
  content: string;
  forDate: string;
}

export interface InsightResponse {
  status: SectionStatus;
  insight: Insight;
  notice?: string;
}

export interface Meme {
  id: string;
  title: string;
  imageUrl: string;
}

export interface MemeResponse {
  status: SectionStatus;
  meme: Meme;
}

export type SectionType = 'NEWS' | 'PRICES' | 'INSIGHT' | 'MEME';
export type VoteType = 'UP' | 'DOWN';

// The client reads `votes` and not `summary`: the aggregation groups by section and vote and
// discards `itemRef`, so only this array can answer "has this user voted on this item?".
// `lastVotedAt` on the summary is deliberately not mirrored — §17 records that the alias is
// wrong for any re-voted item, and nothing may depend on it until that is fixed.
export interface UserVote {
  sectionType: SectionType;
  itemRef: string;
  vote: VoteType;
}
