import type { ContentType } from '../../types/api';

export type SectionKey = 'prices' | 'news' | 'insight' | 'meme';

// Four content types, four sections, and they do not map cleanly — this is a decision, not a
// lookup. MARKET_NEWS, CHARTS and FUN have obvious homes. SOCIAL does not: there is no social
// feed in this product, and the insight is the closest thing to what someone choosing it is
// asking for — commentary rather than raw numbers.
const SECTION_BY_CONTENT_TYPE: Record<ContentType, SectionKey> = {
  MARKET_NEWS: 'news',
  CHARTS: 'prices',
  SOCIAL: 'insight',
  FUN: 'meme',
};

// Used for the unranked remainder, and for the first paint before preferences arrive.
export const DEFAULT_ORDER: SectionKey[] = ['prices', 'insight', 'news', 'meme'];

export interface SectionPlacement {
  key: SectionKey;
  preferred: boolean;
}

// §8.1 orders and never hides, so every section appears whatever the answers were; an unranked
// one renders below, de-emphasised, and fully working.
export function orderSections(contentTypes: ContentType[]): SectionPlacement[] {
  const preferred = contentTypes.map((type) => SECTION_BY_CONTENT_TYPE[type]);
  const ordered = [...preferred, ...DEFAULT_ORDER.filter((key) => !preferred.includes(key))];
  const insightIndex = ordered.indexOf('insight');

  // A product judgement that overrides the stated preference, stated rather than hidden: the
  // insight is the only thing here this project actually produced, and a dashboard that puts it
  // under a meme is a worse dashboard than the one the preference asked for. It still loses its
  // emphasis when unranked — it just never goes below the fold.
  if (insightIndex > 1) {
    ordered.splice(insightIndex, 1);
    ordered.splice(1, 0, 'insight');
  }

  return ordered.map((key) => ({ key, preferred: preferred.includes(key) }));
}

// Before preferences resolve there is no ranking to show, so nothing is de-emphasised — a
// skeleton that faded half the page and then un-faded it would read as a defect.
export const DEFAULT_PLACEMENTS: SectionPlacement[] = DEFAULT_ORDER.map((key) => ({
  key,
  preferred: true,
}));
