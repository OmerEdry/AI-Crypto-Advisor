import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SectionType, UserVote, VoteType } from '../../types/api';
import { fetchVotes, submitVote } from './feedback-api';

const VOTES_KEY = ['votes'];

function replaceVote(votes: UserVote[], next: UserVote): UserVote[] {
  const others = votes.filter(
    (vote) => !(vote.sectionType === next.sectionType && vote.itemRef === next.itemRef),
  );

  return [...others, next];
}

export interface FeedbackControls {
  voteFor: (sectionType: SectionType, itemRef: string) => VoteType | undefined;
  castVote: (vote: UserVote) => void;
  failedItemRef: string | undefined;
}

// §10.5. One query holds every vote on the page, so a section does not need its own request to
// know whether an item was already voted on, and one optimistic write updates whatever is on
// screen.
export function useFeedback(): FeedbackControls {
  const queryClient = useQueryClient();
  const votesQuery = useQuery({ queryKey: VOTES_KEY, queryFn: fetchVotes });

  const mutation = useMutation({
    mutationFn: submitVote,
    // The click paints immediately. Voting is low-stakes and high-frequency, and a 300ms wait
    // to see your own click register reads as broken.
    onMutate: async (next) => {
      // Any refetch already in flight would land after this write and overwrite it with the
      // pre-click server state, so it is cancelled before the cache is touched.
      await queryClient.cancelQueries({ queryKey: VOTES_KEY });

      const previous = queryClient.getQueryData<UserVote[]>(VOTES_KEY);

      queryClient.setQueryData<UserVote[]>(VOTES_KEY, replaceVote(previous ?? [], next));

      return { previous };
    },
    // The rollback restores the whole snapshot rather than removing the one vote: the previous
    // state may have been a vote in the other direction, and deleting it would silently discard
    // a vote the server still holds. A vote that failed must stop looking like one that worked.
    onError: (_error, _next, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<UserVote[]>(VOTES_KEY, context.previous);
      }
    },
    // Settled rather than success: after either outcome the server is the authority on what is
    // stored, and one refetch reconciles an optimistic write that turned out to be wrong.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: VOTES_KEY });
    },
  });

  return {
    voteFor: (sectionType, itemRef) =>
      votesQuery.data?.find((vote) => vote.sectionType === sectionType && vote.itemRef === itemRef)
        ?.vote,
    castVote: (vote) => mutation.mutate(vote),
    failedItemRef: mutation.isError ? mutation.variables.itemRef : undefined,
  };
}
