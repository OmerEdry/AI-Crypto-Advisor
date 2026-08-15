import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import memes from './data/memes.json';

export interface Meme {
  id: string;
  title: string;
  imageUrl: string;
}

// Parsed once at module load, like the curated news feed. The floor of two entries is the real
// invariant: with one entry, honouring `exclude` would have nothing left to return.
const memeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  imageUrl: z.url(),
});

const catalogue: Meme[] = z.array(memeSchema).min(2).parse(memes);

// NF2: the meme changes on every dashboard update, so this is deliberately uncached.
export function getRandom(exclude?: string): Meme {
  const candidates = catalogue.filter((meme) => meme.id !== exclude);

  // An `exclude` that matches nothing — or the only entry — still has to return something.
  const pool = candidates.length > 0 ? candidates : catalogue;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  if (chosen === undefined) {
    throw new AppError('INTERNAL_ERROR', 'No meme is available right now.');
  }

  return chosen;
}
