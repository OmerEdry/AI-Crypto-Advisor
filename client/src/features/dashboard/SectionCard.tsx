import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  preferred: boolean;
  children: ReactNode;
  action?: ReactNode;
}

// §8.1 ranks rather than hides, so the difference between a preferred and an unranked section
// has to be readable at a glance without being a punishment: a preferred one keeps its card
// edge and a bright heading, an unranked one loses the edge and dims. Every control inside
// still works either way.
export function SectionCard({ title, preferred, children, action }: SectionCardProps) {
  return (
    <section
      className={
        preferred
          ? 'rounded-surface border border-border bg-surface p-6'
          : 'rounded-surface p-6 opacity-85'
      }
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={`text-lg font-semibold ${preferred ? 'text-foreground' : 'text-muted'}`}>
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
