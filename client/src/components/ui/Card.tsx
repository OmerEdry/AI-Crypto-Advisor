import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-surface border border-border bg-surface p-6 shadow-lg shadow-bg/40">
      {children}
    </div>
  );
}
