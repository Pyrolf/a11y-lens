import { Copy, Download, Upload } from 'lucide-react';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  buildContrastResults,
  buildCssVariables,
  buildTokenAuditReport,
  countTokens,
  parseTokenDocument,
  validateTokenDocument,
} from '../../engine/tokens/tokenAudit';
import type { AuditResult } from '../../types/audit';

interface DesignTokensEditorProps {
  value: string;
  onChange: (value: string) => void;
  auditResult: AuditResult | null;
}

function copyWithFallback(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Copy command was rejected.');
  } finally {
    textarea.remove();
  }
}

export function DesignTokensEditor({ value, onChange, auditResult }: DesignTokensEditorProps) {
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
        setStatus(`Imported ${file.name}.`);
      }
    };
    reader.onerror = () => setStatus('Import failed. Select a valid JSON file.');
    reader.readAsText(file);
    event.target.value = '';
  };

  const parsed = useMemo(() => parseTokenDocument(value), [value]);
  const documentTokens = parsed.document;
  const contrastChecks = useMemo(
    () => (documentTokens ? buildContrastResults(documentTokens) : []),
    [documentTokens],
  );
  const cssVariables = useMemo(
    () => (documentTokens ? buildCssVariables(documentTokens) : ''),
    [documentTokens],
  );

  const passingCount = contrastChecks.filter((check) => check.passesAaNormal).length;

  const handleCopy = async () => {
    if (!cssVariables) {
      setStatus('Fix the JSON document before copying CSS variables.');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cssVariables);
      } else {
        copyWithFallback(cssVariables);
      }
      setStatus('Copied CSS variables to clipboard.');
    } catch {
      try {
        copyWithFallback(cssVariables);
        setStatus('Copied CSS variables to clipboard.');
      } catch {
        setStatus('Copy failed. Select the JSON and copy manually.');
      }
    }
  };

  const handleDownload = () => {
    if (!documentTokens) {
      setStatus('Fix the JSON document before downloading an audit.');
      return;
    }
    const report = buildTokenAuditReport(
      documentTokens,
      validateTokenDocument(documentTokens),
      contrastChecks,
      auditResult,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'a11y-lens-token-audit.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus('Downloaded a11y-lens-token-audit.json');
  };

  return (
    <div className="flex h-full min-h-90 flex-col" data-testid="design-tokens-editor">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Design Token Editor
          </p>
          <h2 className="text-sm font-semibold text-slate-100">WCAG-ready tokens</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            data-testid="token-file-input"
            className="sr-only"
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="import-token-json"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white"
          >
            <Upload size={14} aria-hidden="true" />
            Import JSON
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!documentTokens}
            data-testid="copy-css-variables"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy size={14} aria-hidden="true" />
            Copy CSS Variables
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!documentTokens}
            data-testid="download-audit-json"
            className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} aria-hidden="true" />
            Download Audit JSON
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Token JSON</h3>
            <span className="text-xs text-slate-400">
              {documentTokens ? `${countTokens(documentTokens)} tokens` : 'awaiting valid JSON'}
            </span>
          </div>
          <label className="sr-only" htmlFor="token-json-editor">
            Design token JSON editor
          </label>
          <textarea
            id="token-json-editor"
            data-testid="token-json-editor"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            className="h-105 w-full resize-y rounded-md border border-slate-800 bg-slate-950/80 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          />
          {parsed.error && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {parsed.error} — fix the JSON to refresh the insights panel.
            </p>
          )}
        </section>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400"
      >
        {status ||
          `${passingCount}/${contrastChecks.length} AA pairs passing · checks run locally, no network calls`}
      </div>
    </div>
  );
}
