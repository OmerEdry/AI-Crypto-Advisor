import { z } from 'zod';

// bcrypt ignores everything past 72 bytes, so a longer password would silently share its hash
// with its own prefix. The bound also stops a 10kb body buying a cost-factor-12 hash.
const PASSWORD_MAX = 72;

// Trim and lowercase run before the format check, not after, so a pasted " Omer@Example.com "
// is stored exactly as it will later be looked up. The email column is unique and login is an
// exact match, so normalising at the boundary is what stops one person owning two accounts.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

export const registerSchema = z.object({
  name: z.string().trim().min(2, { error: 'Must be at least 2 characters.' }),
  email: emailSchema,
  password: z
    .string()
    .min(8, { error: 'Must be at least 8 characters.' })
    .max(PASSWORD_MAX, { error: `Must be at most ${PASSWORD_MAX} characters.` }),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not the register rules. Rejecting a too-short password here would answer with
  // a 400 where §7.6 requires one indistinguishable 401 for every failed sign-in.
  password: z
    .string()
    .min(1, { error: 'Enter your password.' })
    .max(PASSWORD_MAX, { error: `Must be at most ${PASSWORD_MAX} characters.` }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
