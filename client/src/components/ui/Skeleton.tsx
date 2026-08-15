// Skeletons rather than spinners (§9.4): each section renders a shape the size of what is
// coming, so a slow section never blocks a fast one and the page does not resize under the
// reader when data lands.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-surface bg-surface-alt ${className}`} />;
}
