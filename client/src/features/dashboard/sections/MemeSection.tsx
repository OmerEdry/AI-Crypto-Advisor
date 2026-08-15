import { useState } from 'react';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SectionCard } from '../SectionCard';
import { sectionErrorMessage } from '../section-error';
import { useMeme } from '../use-dashboard-queries';
import { VoteButtons } from '../VoteButtons';

export function MemeSection({ preferred }: { preferred: boolean }) {
  // Which meme to exclude is a piece of local interaction state — what the reader has just
  // seen — so it is useState, while the meme it fetches is server state. The server honours
  // `?exclude` (§10 Step 10), which is what stops the same image coming back twice in a row.
  const [exclude, setExclude] = useState<string>();
  const meme = useMeme(exclude);

  return (
    <SectionCard
      title="Something lighter"
      preferred={preferred}
      action={
        <div className="flex items-center gap-2">
          {meme.data && (
            <VoteButtons sectionType="MEME" itemRef={meme.data.meme.id} label="this meme" />
          )}
          <button
            type="button"
            disabled={meme.isFetching || !meme.data}
            onClick={() => meme.data && setExclude(meme.data.meme.id)}
            className="rounded-surface border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {meme.isFetching ? 'Finding one…' : 'Show another'}
          </button>
        </div>
      }
    >
      {meme.isPending ? (
        <Skeleton className="mx-auto h-64 w-full max-w-md" />
      ) : meme.isError ? (
        <ErrorState message={sectionErrorMessage(meme.error)} onRetry={() => void meme.refetch()} />
      ) : (
        <figure>
          {/* meme-7 is 1045x2235. Without object-contain and a ceiling, one portrait image owns
              the whole page. */}
          <img
            src={meme.data.meme.imageUrl}
            alt={meme.data.meme.title}
            className="mx-auto max-h-[26rem] w-auto rounded-surface object-contain"
          />
          <figcaption className="mt-3 text-center text-sm text-muted">
            {meme.data.meme.title}
          </figcaption>
        </figure>
      )}
    </SectionCard>
  );
}
