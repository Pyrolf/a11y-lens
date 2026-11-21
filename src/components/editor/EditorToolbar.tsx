import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface EditorToolbarProps {
  snippetName: string;
  onRerunAudit: () => void;
  onOpenAiFix: () => void;
}

const SYNCED_FLASH_MS = 1200;

export function EditorToolbar({ snippetName, onRerunAudit, onOpenAiFix }: EditorToolbarProps) {
  const [showSynced, setShowSynced] = useState(false);
  const syncedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (syncedTimerRef.current !== null) window.clearTimeout(syncedTimerRef.current);
    };
  }, []);

  const handleRerun = () => {
    onRerunAudit();
    setShowSynced(true);
    if (syncedTimerRef.current !== null) window.clearTimeout(syncedTimerRef.current);
    syncedTimerRef.current = window.setTimeout(() => {
      setShowSynced(false);
      syncedTimerRef.current = null;
    }, SYNCED_FLASH_MS);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">HTML / Tailwind Editor</p>
        <h2 className="text-sm font-semibold text-slate-100">{snippetName}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div
          role="status"
          aria-live="polite"
          data-testid="auto-audit-status"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Auto-Audit: ON
          {showSynced && (
            <span
              data-testid="auto-audit-synced"
              className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs uppercase tracking-wide text-emerald-100"
            >
              Synced
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="rerun-audit-button"
          onClick={handleRerun}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Re-run
        </button>
        <button
          type="button"
          onClick={onOpenAiFix}
          className="inline-flex items-center gap-2 rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
        >
          <Sparkles size={16} aria-hidden="true" />
          AI Fix
        </button>
      </div>
    </div>
  );
}
