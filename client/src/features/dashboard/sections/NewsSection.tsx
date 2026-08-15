import { DegradedNotice } from '../../../components/ui/DegradedNotice';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { NewsArticle } from '../../../types/api';
import { formatDate } from '../format';
import { SectionCard } from '../SectionCard';
import { sectionErrorMessage } from '../section-error';
import { useNews } from '../use-dashboard-queries';
import { VoteButtons } from '../VoteButtons';

function ArticleRow({ article }: { article: NewsArticle }) {
  return (
    <li className="flex items-start justify-between gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-4 lg:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+2)]:pt-0">
      <div className="min-w-0">
        <a
          href={article.url}
          target="_blank"
          // noreferrer as well as noopener: the target page has no business learning which page
          // linked to it.
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {article.title}
        </a>
        <p className="mt-1 text-sm text-muted">
          {article.source} · {formatDate(article.publishedAt)}
        </p>
      </div>
      <VoteButtons sectionType="NEWS" itemRef={article.itemRef} label="this story" />
    </li>
  );
}

export function NewsSection({ preferred }: { preferred: boolean }) {
  const news = useNews();

  return (
    <SectionCard title="Market news" preferred={preferred}>
      {news.isPending ? (
        <div className="grid gap-x-8 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="py-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : news.isError ? (
        <ErrorState message={sectionErrorMessage(news.error)} onRetry={() => void news.refetch()} />
      ) : news.data.articles.length === 0 ? (
        // Reachable rather than hypothetical: eleven of the twenty allowlisted coins have no
        // curated article. The hint says what will change the state, and does not invite the
        // reader to edit preferences, which there is currently no screen for.
        <EmptyState
          title="No stories yet for the assets you picked"
          hint="The curated feed adds coverage as it publishes. Prices and today's insight are unaffected."
        />
      ) : (
        <>
          <ul className="grid gap-x-8 lg:grid-cols-2">
            {news.data.articles.map((article) => (
              <ArticleRow key={article.itemRef} article={article} />
            ))}
          </ul>
          {news.data.notice !== undefined && <DegradedNotice notice={news.data.notice} />}
        </>
      )}
    </SectionCard>
  );
}
