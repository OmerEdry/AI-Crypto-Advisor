import type { ContentType, InvestorType, Preference } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import type { PreferencesInput } from './preferences.schema';

export interface PublicPreferences {
  assets: string[];
  investorType: InvestorType;
  contentTypes: ContentType[];
  updatedAt: Date;
}

// `id` means nothing to the client and `userId` is the caller's own, so neither is returned.
function toPublicPreferences(preference: Preference): PublicPreferences {
  return {
    assets: preference.assets,
    investorType: preference.investorType,
    contentTypes: preference.contentTypes,
    updatedAt: preference.updatedAt,
  };
}

export async function get(userId: string): Promise<PublicPreferences> {
  const preference = await prisma.preference.findUnique({ where: { userId } });

  if (!preference) {
    throw new AppError('NOT_FOUND', 'You have not set your preferences yet. Complete onboarding.');
  }

  return toPublicPreferences(preference);
}

export async function upsert(userId: string, input: PreferencesInput): Promise<PublicPreferences> {
  const data = {
    assets: input.assets,
    investorType: input.investorType,
    contentTypes: input.contentTypes,
  };

  // Both writes or neither. Without the transaction, a committed preferences row could be
  // paired with a user still flagged as not onboarded — leaving them gated on the screen they
  // just finished.
  const [preference] = await prisma.$transaction([
    prisma.preference.upsert({ where: { userId }, create: { userId, ...data }, update: data }),
    // updateMany rather than update: update takes a unique `where` and cannot also require the
    // column still be null. That guard is what keeps this the *first* completion time — §4.1
    // wants the timestamp for time-from-signup, which a later re-save would overwrite.
    prisma.user.updateMany({
      where: { id: userId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    }),
  ]);

  return toPublicPreferences(preference);
}
