import { Prisma, type DailyInsight } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import * as pricesService from '../market/prices.service';
import * as preferencesService from '../preferences/preferences.service';
import { createCompletion } from './llm/openrouter.client';
import {
  buildInsightPrompt,
  buildTemplateInsight,
  PROMPT_VERSION,
  type InsightInput,
} from './llm/prompt';

const TEMPLATE_MODEL = 'template';

export interface PublicInsight {
  id: string;
  content: string;
  forDate: Date;
}

export interface InsightResult {
  status: 'ok' | 'degraded';
  insight: PublicInsight;
  notice?: string;
}

// Built from the UTC parts explicitly rather than from a local Date. `forDate` is @db.Date, so a
// machine east of UTC would otherwise store the wrong calendar day for several hours each night
// and "insight of the day" would mean two different days for two users at the same moment.
function todayUtc(): Date {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toResult(row: DailyInsight): InsightResult {
  const degraded = row.source !== 'llm';

  return {
    status: degraded ? 'degraded' : 'ok',
    insight: { id: row.id, content: row.content, forDate: row.forDate },
    // Deliberately does not invite a retry: the row is persisted for the whole UTC day, so
    // requesting again returns this same text. Saying "try again" would be false.
    ...(degraded
      ? {
          notice:
            "Generated from your preferences — the AI service wasn't reachable when today's insight was created. A fresh one is written tomorrow.",
        }
      : {}),
  };
}

async function buildInput(userId: string): Promise<InsightInput> {
  const preferences = await preferencesService.get(userId);
  // §8.2 wants prices from cache rather than a dedicated fetch. Going through the prices service
  // is what makes that true: it is cache-first, so a warm cache costs nothing, and a cold one
  // reuses the same batched call the prices section would have made. Reading the cache directly
  // would have raced the dashboard's parallel requests and baked a price-less insight in for the
  // entire day.
  const prices = await pricesService.getPricesFor(userId);

  return {
    investorType: preferences.investorType,
    assets: preferences.assets,
    contentTypes: preferences.contentTypes,
    coins: prices.coins,
  };
}

interface GeneratedInsight {
  content: string;
  model: string;
  source: 'llm' | 'fallback';
}

async function generate(input: InsightInput): Promise<GeneratedInsight> {
  if (!env.LLM_ENABLED || env.LLM_MODEL === undefined) {
    return { content: buildTemplateInsight(input), model: TEMPLATE_MODEL, source: 'fallback' };
  }

  const startedAt = Date.now();

  try {
    const completion = await createCompletion(buildInsightPrompt(input), env.LLM_MODEL);

    return { content: completion.content, model: completion.model, source: 'llm' };
  } catch (error) {
    // The single try/catch for this provider call (§9.3). It degrades rather than rethrows,
    // because a dashboard section that renders a template is worth more than one that errors.
    const appError =
      error instanceof AppError
        ? error
        : new AppError('UPSTREAM_ERROR', 'OpenRouter could not be reached.');

    logger.warn('Insight generation failed, using the deterministic template', {
      provider: 'openrouter',
      code: appError.code,
      elapsedMs: Date.now() - startedAt,
      cause: appError.message,
    });

    return { content: buildTemplateInsight(input), model: TEMPLATE_MODEL, source: 'fallback' };
  }
}

export async function getTodaysInsight(userId: string): Promise<InsightResult> {
  const forDate = todayUtc();
  const where = { userId_forDate: { userId, forDate } };

  // §8.3: read through, then generate. This is the line that keeps the feature inside a ~50
  // request/day account-wide ceiling — every refresh after the first costs one indexed SELECT.
  const existing = await prisma.dailyInsight.findUnique({ where });

  if (existing) {
    return toResult(existing);
  }

  const generated = await generate(await buildInput(userId));

  try {
    const created = await prisma.dailyInsight.create({
      data: {
        userId,
        forDate,
        content: generated.content,
        model: generated.model,
        promptVersion: PROMPT_VERSION,
        source: generated.source,
      },
    });

    return toResult(created);
  } catch (error) {
    // Two requests can both miss the read above and both generate. The unique constraint decides
    // which row exists; the loser reads the winner's rather than failing. Same P2002-carries-
    // business-meaning pattern as a duplicate email in auth.service.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.dailyInsight.findUnique({ where });

      if (winner) {
        return toResult(winner);
      }
    }

    throw error;
  }
}
