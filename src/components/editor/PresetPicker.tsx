import { AlertTriangle } from 'lucide-react';
import type { SnippetPreset } from '../../lib/sampleSnippets';

interface PresetPickerProps {
  presets: SnippetPreset[];
  selectedPresetId: string;
  onLoad: (preset: SnippetPreset) => void;
}

export function PresetPicker({ presets, selectedPresetId, onLoad }: PresetPickerProps) {
  return (
    <div className="border-b border-slate-800 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
        <AlertTriangle size={13} aria-hidden="true" />
        Snippet presets
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedPresetId;
          const isStarter = preset.kind === 'starter';
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`preset-${preset.id}`}
              aria-pressed={isSelected}
              aria-label={
                isStarter
                  ? `Load default preset: ${preset.name}`
                  : `Load broken preset: ${preset.name}`
              }
              onClick={() => onLoad(preset)}
              title={preset.description}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isStarter
                  ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 focus-visible:outline-indigo-400'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15 focus-visible:outline-amber-400'
              } ${isSelected ? 'ring-1 ring-white/60' : ''}`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
