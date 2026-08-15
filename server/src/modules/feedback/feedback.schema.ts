import { z } from 'zod';
import { SectionType, VoteType } from '@prisma/client';

// The enums come from the Prisma client rather than a hand-written list, so a value added to
// schema.prisma cannot drift out of sync with what the API accepts.
//
// `itemRef` is caller-supplied and lands inside a unique index, so §4.3 bounds it: index entries
// have a size ceiling, and an unbounded key is a latent failure rather than a loud one. 128 sits
// well above the longest real value — a 25-character cuid for INSIGHT — while the charset admits
// exactly the forms §4.3 lists (`bitcoin`, `static:news-3`, `cryptopanic:12345`, `meme-1`) and
// rejects whitespace, quotes and control characters.
//
// There is deliberately no existence check. A vote is a per-user signal, not a foreign key, and
// verifying the target would mean this module calling four other services to ask permission.
export const feedbackSchema = z.object({
  sectionType: z.enum(SectionType, { error: 'Choose one of the supported sections.' }),
  itemRef: z
    .string({ error: 'itemRef must be a string.' })
    .trim()
    .min(1, { error: 'itemRef is required.' })
    .max(128, { error: 'itemRef must be at most 128 characters.' })
    .regex(/^[A-Za-z0-9:_-]+$/, {
      error: 'itemRef may contain only letters, digits, and the characters : _ -',
    }),
  vote: z.enum(VoteType, { error: 'A vote is either UP or DOWN.' }),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
