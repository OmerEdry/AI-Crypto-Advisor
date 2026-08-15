import { z } from 'zod';
import { ContentType, InvestorType } from '@prisma/client';
import { COIN_ALLOWLIST } from '../../config/coins';

const CONTENT_TYPE_COUNT = Object.keys(ContentType).length;

// Set preserves insertion order, so the first occurrence survives. That matters for
// contentTypes, which §8.1 uses to order dashboard sections — it is a ranking, not a set,
// and dropping the earlier copy would silently demote the user's top choice.
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

// The enums come from the Prisma client rather than a hand-written list, so a value added to
// schema.prisma cannot drift out of sync with what the API accepts.
export const preferencesSchema = z.object({
  assets: z
    .array(z.enum(COIN_ALLOWLIST, { error: 'Choose assets from the supported list.' }), {
      error: 'Assets must be a list.',
    })
    .min(1, { error: 'Choose at least one asset.' })
    .max(COIN_ALLOWLIST.length, { error: `Choose at most ${COIN_ALLOWLIST.length} assets.` })
    .transform(unique),
  investorType: z.enum(InvestorType, { error: 'Choose one of the supported investor types.' }),
  contentTypes: z
    .array(z.enum(ContentType, { error: 'Choose content types from the supported list.' }), {
      error: 'Content types must be a list.',
    })
    .min(1, { error: 'Choose at least one content type.' })
    .max(CONTENT_TYPE_COUNT, { error: `Choose at most ${CONTENT_TYPE_COUNT} content types.` })
    .transform(unique),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
