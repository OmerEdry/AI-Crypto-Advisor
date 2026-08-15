import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatDate } from '../format';
import { SectionCard } from '../SectionCard';
import { sectionErrorMessage } from '../section-error';
import { useInsight } from '../use-dashboard-queries';
import { VoteButtons } from '../VoteButtons';

// The signature element. It is the only thing on this page the project itself produced —
// everything else is other people's data rendered competently — so it is the one place the
// amber rule, the raised ground and the larger measure appear.
//
// The type stays in the interface sans. A system serif here read as an inconsistency rather
// than as emphasis: nothing else on the page is serif, and a reader parses that as a mistake
// before they parse it as hierarchy. Size, measure and ground carry the emphasis instead.
export function InsightSection({ preferred }: { preferred: boolean }) {
  const insight = useInsight();
  const title = insight.data
    ? `Insight for ${formatDate(insight.data.insight.forDate)}`
    : "Today's insight";

  return (
    <SectionCard
      title={title}
      preferred={preferred}
      action={
        insight.data && (
          <VoteButtons
            sectionType="INSIGHT"
            itemRef={insight.data.insight.id}
            label="this insight"
          />
        )
      }
    >
      {insight.isError ? (
        <ErrorState
          message={sectionErrorMessage(insight.error)}
          onRetry={() => void insight.refetch()}
        />
      ) : (
        <div className="rounded-surface border-l-[3px] border-accent bg-surface-alt px-6 py-5">
          {insight.isPending ? (
            <div className="max-w-[60ch] space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-11/12" />
              <Skeleton className="mt-2 h-5 w-2/3" />
            </div>
          ) : (
            <p className="max-w-[60ch] text-[1.375rem] leading-relaxed">
              {insight.data.insight.content}
            </p>
          )}

          {/* A template insight keeps the rule, the ground, the size and the position — a
              signature element that degrades into an apologetic grey box is worse than one that
              degrades with its dignity intact. The notice deliberately does not invite a retry
              and gets no retry control: §17 records that the row is persisted for the whole UTC
              day, so trying again returns this same text, and saying otherwise would be false. */}
          {insight.data?.notice !== undefined && (
            <p className="mt-5 max-w-[60ch] border-t border-border pt-4 text-sm text-muted">
              {insight.data.notice}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
