import type { ReactNode } from 'react';

interface WorkbenchShellProps {
  header: ReactNode;
  children: ReactNode;
  drawer?: ReactNode;
}

export function WorkbenchShell({ header, children, drawer }: WorkbenchShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#main-content"
        className="sr-only z-100 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex min-h-screen max-w-450 flex-col px-4 py-4 sm:px-6">
        {header}
        <main id="main-content" className="flex min-h-0 flex-1 flex-col" tabIndex={-1}>
          {children}
        </main>
      </div>
      {drawer}
    </div>
  );
}
