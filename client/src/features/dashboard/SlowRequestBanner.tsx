import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

const SLOW_AFTER_MS = 3000;

// §9.4. The free tier sleeps after fifteen minutes and takes thirty to sixty seconds to wake,
// and untreated that first visit looks like a broken application. Naming the wait is honest and
// costs nothing; hiding it spends the reader's patience without telling them what on.
export function SlowRequestBanner() {
  const fetching = useIsFetching();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (fetching === 0) {
      setSlow(false);

      return;
    }

    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    return () => clearTimeout(timer);
  }, [fetching]);

  if (!slow) {
    return null;
  }

  return (
    <p className="rounded-surface border border-border bg-surface px-4 py-3 text-sm text-muted">
      Waking up the server — this can take up to a minute on the free tier.
    </p>
  );
}
