import type { ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="min-h-80 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        {left}
      </section>
      <section className="min-h-80 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        {right}
      </section>
    </div>
  );
}
