import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface WorkbenchErrorBoundaryProps {
  children: ReactNode;
}

interface WorkbenchErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence for untrusted DOM inputs and malformed data. Pure
 * helpers (token JSON parsing, audit rules) fail soft on their own; this
 * boundary catches anything unexpected during render or effects and shows a
 * recoverable banner instead of a blank application.
 */
export class WorkbenchErrorBoundary extends Component<
  WorkbenchErrorBoundaryProps,
  WorkbenchErrorBoundaryState
> {
  state: WorkbenchErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WorkbenchErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A11y-Lens workbench error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div role="alert" className="w-full max-w-lg rounded-xl border border-rose-500/30 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert size={24} className="text-rose-300" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold">Workbench recovered</h1>
              <p className="text-sm text-slate-300">
                Something in the current snippet or token document could not be rendered. Your
                source is untouched and the deterministic engine is still client-side only.
              </p>
            </div>
          </div>
          <pre className="mt-4 overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-rose-200">
            {error.message || 'Unknown rendering error'}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reload workbench
          </button>
        </div>
      </div>
    );
  }
}
