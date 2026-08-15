import { z } from 'zod';
import { env } from '../../../config/env';
import { AppError } from '../../../errors/app-error';
import type { LlmPrompt } from './prompt';

const COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

// §9.3: 10s for the LLM, longer than a data provider because generation genuinely takes longer.
const TIMEOUT_MS = 10_000;

// OpenAI-compatible. `model` at the root of the response is what actually served the request,
// which can differ from what was asked for, so it is that value we persist.
const completionSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
});

export interface LlmCompletion {
  content: string;
  model: string;
}

export async function createCompletion(prompt: LlmPrompt, model: string): Promise<LlmCompletion> {
  const response = await fetch(COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // §6.4 keeps these distinct because the user's next action differs: a rate limit means wait,
  // a transient error means retry. Here both degrade to the template, but they log differently.
  if (response.status === 429) {
    throw new AppError('UPSTREAM_RATE_LIMITED', 'OpenRouter is rate-limiting requests.');
  }

  if (!response.ok) {
    throw new AppError('UPSTREAM_ERROR', `OpenRouter responded with ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const parsed = completionSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError('UPSTREAM_ERROR', 'OpenRouter returned a response in an unexpected shape.');
  }

  const content = parsed.data.choices[0]?.message.content.trim();

  // A well-formed reply carrying no text is a real outcome on free models, not a parse failure,
  // so it gets its own message rather than being reported as a bad shape.
  if (content === undefined || content.length === 0) {
    throw new AppError('UPSTREAM_ERROR', 'OpenRouter returned an empty completion.');
  }

  return { content, model: parsed.data.model ?? model };
}
