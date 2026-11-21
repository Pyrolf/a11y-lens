import type { TextDiffLine } from '../../types/ai';

interface FixDiffViewProps {
  diff: TextDiffLine[];
}

const lineClass: Record<TextDiffLine['type'], string> = {
  context: 'text-slate-300',
  add: 'bg-emerald-500/15 text-emerald-200',
  remove: 'bg-rose-500/15 text-rose-200',
};

const prefix: Record<TextDiffLine['type'], string> = {
  context: ' ',
  add: '+',
  remove: '-',
};

export function FixDiffView({ diff }: FixDiffViewProps) {
  if (diff.length === 0) {
    return <p className="text-sm text-slate-400">No diff generated.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800" data-testid="ai-fix-diff">
      <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/80 text-xs font-medium uppercase tracking-wide text-slate-400">
        <div className="px-3 py-2">Before</div>
        <div className="border-l border-slate-800 px-3 py-2">After</div>
      </div>
      <div className="max-h-80 overflow-auto bg-slate-950 font-mono text-xs leading-5">
        {diff.map((line, index) => (
          <div
            key={`${line.type}-${index}-${line.oldLineNumber ?? 'n'}-${line.newLineNumber ?? 'n'}`}
            className={`grid grid-cols-[3rem_1fr_3rem_1fr] ${lineClass[line.type]}`}
          >
            <span className="select-none px-2 text-right text-slate-400">
              {line.type === 'add' ? '' : line.oldLineNumber ?? ''}
            </span>
            <span className="border-r border-slate-800/80 px-2 whitespace-pre-wrap break-all">
              <span className="mr-1 select-none text-slate-400">{line.type === 'add' ? '' : prefix[line.type]}</span>
              {line.type === 'add' ? '' : line.content || ' '}
            </span>
            <span className="select-none px-2 text-right text-slate-400">
              {line.type === 'remove' ? '' : line.newLineNumber ?? ''}
            </span>
            <span className="px-2 whitespace-pre-wrap break-all">
              <span className="mr-1 select-none text-slate-400">{line.type === 'remove' ? '' : prefix[line.type]}</span>
              {line.type === 'remove' ? '' : line.content || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
