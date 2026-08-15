import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),

    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    // An enum rather than a free string so a typo fails at boot. jsonwebtoken types `expiresIn`
    // as a template-literal union, which a plain `string` is not assignable to; these five
    // literals are, and token.service.ts maps each to the matching cookie lifetime.
    JWT_EXPIRES_IN: z.enum(['15m', '1h', '1d', '7d', '30d']).default('7d'),
    COOKIE_NAME: z.string().min(1).default('cca_token'),

    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim())),

    COINGECKO_API_KEY: z.string().min(1),
    // Intentionally optional — no token was obtained and the static feed serves news (§9.2a).
    CRYPTOPANIC_TOKEN: z.string().optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    // Optional until Step 9 reads it; free model IDs rotate, so it is env-driven.
    LLM_MODEL: z.string().optional(),
    LLM_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    CACHE_TTL_PRICES_MS: z.coerce.number().int().positive().default(120_000),
    CACHE_TTL_NEWS_MS: z.coerce.number().int().positive().default(600_000),
  })
  // LLM_MODEL stays optional on its own because LLM_ENABLED=false is a supported configuration.
  // Required together, though: enabling the LLM without naming a model would pass boot and then
  // fail on the first request as a 400 from OpenRouter — a broken dashboard section days later
  // instead of a crash on deploy, which is the trade §15 exists to prevent.
  .refine((value) => !value.LLM_ENABLED || (value.LLM_MODEL ?? '').length > 0, {
    error: 'is required when LLM_ENABLED is true',
    path: ['LLM_MODEL'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Names and rules only. Printing the offending value would put a secret in the crash log.
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment variables:\n${problems}`);
}

export const env = parsed.data;
