import type { Feedback, SectionType, VoteType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { findVoteSummary } from './feedback.repository';
import type { FeedbackInput } from './feedback.schema';

// `id` means nothing to the client and `userId` is the caller's own, so neither is returned —
// the same mapper discipline as preferences.
export interface PublicFeedback {
  sectionType: SectionType;
  itemRef: string;
  vote: VoteType;
  updatedAt: Date;
}

// `investorType` is dropped here: the query pins a single user, so the column is constant across
// every row, and the client already has it from GET /api/preferences.
export interface VoteSummaryEntry {
  sectionType: SectionType;
  vote: VoteType;
  total: number;
  lastVotedAt: Date;
}

// The aggregation discards `itemRef`, so it cannot answer "has this user voted on this item?" —
// which is what the dashboard needs to render an existing vote after a refresh (§10.5).
export interface UserVote {
  sectionType: SectionType;
  itemRef: string;
  vote: VoteType;
}

export interface FeedbackSummary {
  summary: VoteSummaryEntry[];
  votes: UserVote[];
}

function toPublicFeedback(row: Feedback): PublicFeedback {
  return {
    sectionType: row.sectionType,
    itemRef: row.itemRef,
    vote: row.vote,
    updatedAt: row.updatedAt,
  };
}

export async function recordVote(userId: string, input: FeedbackInput): Promise<PublicFeedback> {
  // One round trip, and the composite unique constraint decides the outcome: a first vote inserts,
  // a changed vote updates the same row. Find-then-create would have a race window between the
  // check and the write, and could leave the same user holding two votes on one item.
  const row = await prisma.feedback.upsert({
    where: {
      userId_sectionType_itemRef: {
        userId,
        sectionType: input.sectionType,
        itemRef: input.itemRef,
      },
    },
    create: {
      userId,
      sectionType: input.sectionType,
      itemRef: input.itemRef,
      vote: input.vote,
    },
    update: { vote: input.vote },
  });

  return toPublicFeedback(row);
}

// The one aggregation, and the one place its rows become the public shape. Called both by the
// summary endpoint and by the insight prompt builder (§4.4).
export async function getVoteSummary(userId: string): Promise<VoteSummaryEntry[]> {
  const rows = await findVoteSummary(userId);

  return rows.map((row) => ({
    sectionType: row.section_type,
    vote: row.vote,
    total: row.total,
    lastVotedAt: row.last_voted_at,
  }));
}

export async function getSummary(userId: string): Promise<FeedbackSummary> {
  const [summary, votes] = await Promise.all([
    getVoteSummary(userId),
    prisma.feedback.findMany({
      where: { userId },
      select: { sectionType: true, itemRef: true, vote: true },
    }),
  ]);

  return { summary, votes };
}
