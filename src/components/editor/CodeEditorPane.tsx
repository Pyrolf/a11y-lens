import type { SnippetPreset } from '../../lib/sampleSnippets';
import type { CodeSnippet } from '../../types/editor';
import { EditorToolbar } from './EditorToolbar';
import { PresetPicker } from './PresetPicker';

interface CodeEditorPaneProps {
  snippet: CodeSnippet;
  presets: SnippetPreset[];
  selectedPresetId: string;
  onChange: (html: string) => void;
  onRerunAudit: () => void;
  onOpenAiFix: () => void;
  onLoadPreset: (preset: SnippetPreset) => void;
}

export function CodeEditorPane({
  snippet,
  presets,
  selectedPresetId,
  onChange,
  onRerunAudit,
  onOpenAiFix,
  onLoadPreset,
}: CodeEditorPaneProps) {
  return (
    <div className="flex h-full min-h-90 flex-col">
      <EditorToolbar snippetName={snippet.name} onRerunAudit={onRerunAudit} onOpenAiFix={onOpenAiFix} />
      <PresetPicker presets={presets} selectedPresetId={selectedPresetId} onLoad={onLoadPreset} />
      <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
        Deterministic checks run locally on every change. User markup renders in an isolated iframe preview.
      </div>
      <label className="sr-only" htmlFor="snippet-editor">
        HTML and Tailwind snippet editor
      </label>
      <textarea
        id="snippet-editor"
        value={snippet.html}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="min-h-80 flex-1 resize-none bg-slate-950/80 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
        aria-label="HTML and Tailwind snippet editor"
      />
    </div>
  );
}
