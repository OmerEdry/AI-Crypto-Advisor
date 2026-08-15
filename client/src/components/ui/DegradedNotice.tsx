// §6.3: degraded means something was served, but not the real thing. It is information, not an
// error — so this reads as a quiet statement of fact rather than a warning, and carries no
// retry control. The news section is permanently degraded by design (§9.2a), so this line is on
// screen every visit; styled as an alarm it would train the reader to distrust a working page,
// and hidden it would be the dashboard lying about where its content came from.
export function DegradedNotice({ notice }: { notice: string }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-sm text-muted">
      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-muted" aria-hidden="true" />
      {notice}
    </p>
  );
}
