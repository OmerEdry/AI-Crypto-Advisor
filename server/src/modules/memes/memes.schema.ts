import { z } from 'zod';

// §4.3 makes the meme id the itemRef for MEME feedback, so it is bounded here for the same
// reason itemRef is: an unbounded caller-supplied string has no business reaching a lookup.
export const memesQuerySchema = z.object({
  exclude: z.string().min(1).max(64).optional(),
});

export type MemesQuery = z.infer<typeof memesQuerySchema>;
