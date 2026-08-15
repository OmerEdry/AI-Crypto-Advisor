import type { InvestorType, SectionType, VoteType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// The keys are the column names §4.4's statement returns, not camelCase: `$queryRaw` hands back
// whatever the driver names each column, and the statement is reproduced verbatim rather than
// aliased, because aliasing would mean quoting identifiers — which is the cost the snake_case
// mapping in §17 was chosen to avoid. The service maps this to the public shape.
//
// `investor_type` is nullable because the join to preferences is a LEFT JOIN: a user who has not
// completed onboarding has no preferences row, and an INNER join would return them zero vote rows
// rather than their votes with no investor type.
export interface VoteSummaryRow {
  section_type: SectionType;
  vote: VoteType;
  total: number;
  last_voted_at: Date;
  investor_type: InvestorType | null;
}

export async function findVoteSummary(userId: string): Promise<VoteSummaryRow[]> {
  // §4.4, as written. `${userId}` inside a tagged template is sent as a bound parameter, never
  // interpolated into the query text, so the driver cannot confuse data for code.
  //
  // `COUNT(*)::int` rather than `COUNT(*)`: Postgres counts as bigint, which the driver returns
  // as a JavaScript BigInt — and `JSON.stringify` throws on one, so the cast is what keeps this
  // serialisable in a response body.
  return prisma.$queryRaw<VoteSummaryRow[]>`
    SELECT
      f.section_type,
      f.vote,
      COUNT(*)::int      AS total,
      MAX(f.created_at)  AS last_voted_at,
      p.investor_type
    FROM feedback f
    JOIN users u            ON u.id      = f.user_id
    LEFT JOIN preferences p ON p.user_id = u.id
    WHERE f.user_id = ${userId}
    GROUP BY f.section_type, f.vote, p.investor_type
    ORDER BY f.section_type;
  `;
}
