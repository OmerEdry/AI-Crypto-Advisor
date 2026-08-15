import { apiRequest } from '../../lib/api-client';
import { asArray, asRecord, asString, shapeError } from '../../lib/parse';
import type { SectionType, UserVote, VoteType } from '../../types/api';

const SECTION_TYPES: SectionType[] = ['NEWS', 'PRICES', 'INSIGHT', 'MEME'];
const VOTE_TYPES: VoteType[] = ['UP', 'DOWN'];

function asSectionType(value: unknown, endpoint: string): SectionType {
  const parsed = SECTION_TYPES.find((type) => type === value);

  if (parsed === undefined) {
    throw shapeError(endpoint);
  }

  return parsed;
}

function asVoteType(value: unknown, endpoint: string): VoteType {
  const parsed = VOTE_TYPES.find((type) => type === value);

  if (parsed === undefined) {
    throw shapeError(endpoint);
  }

  return parsed;
}

// Only the `votes` half of the response is read here. The aggregation in `summary` answers a
// different question — how many, by section — and nothing on this page asks it.
export async function fetchVotes(): Promise<UserVote[]> {
  const endpoint = '/feedback/summary';
  const payload = asRecord(await apiRequest('/feedback/summary'), endpoint);

  return asArray(payload.votes, endpoint).map((entry) => {
    const vote = asRecord(entry, endpoint);

    return {
      sectionType: asSectionType(vote.sectionType, endpoint),
      itemRef: asString(vote.itemRef, endpoint),
      vote: asVoteType(vote.vote, endpoint),
    };
  });
}

// The server upserts on (userId, sectionType, itemRef), so this is the same call whether it is
// a first vote or a change of mind, and the response is not read: the cache already holds what
// the click implied.
export async function submitVote(vote: UserVote): Promise<void> {
  await apiRequest('/feedback', { method: 'POST', body: vote });
}
