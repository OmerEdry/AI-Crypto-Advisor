// An empty state is an invitation to act, not a blank region (§10.6). The caller supplies both
// lines because what a reader can do about an empty section differs entirely between them.
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-surface border border-dashed border-border p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}
