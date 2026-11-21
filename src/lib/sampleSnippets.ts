import type { CodeSnippet } from '../types/editor';

const now = '2026-11-21T00:00:00.000Z';

const SAMPLE_SNIPPET: CodeSnippet = {
  id: 'sample-landing-card',
  name: 'Landing Card',
  language: 'html-tailwind',
  html: `<main class="min-h-screen bg-slate-950 text-slate-100 p-8">
  <section class="mx-auto max-w-xl rounded-2xl bg-slate-900 p-6 shadow-lg">
    <p class="text-sm uppercase tracking-wide text-slate-400">A11y Lens Demo</p>
    <h1 class="mt-2 text-3xl font-bold">Ship accessible UI faster</h1>
    <p class="mt-3 text-slate-300">Audit HTML and Tailwind snippets before they ship.</p>
    <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80" class="mt-4 h-48 w-full rounded-lg object-cover" />
    <div class="mt-5 flex gap-3">
      <button class="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">Get started</button>
      <a class="rounded-md border border-slate-600 px-4 py-2 text-slate-200" href="#"> </a>
    </div>
    <h4 class="mt-6 text-sm text-slate-400">Trusted by teams</h4>
  </section>
</main>`,
  createdAt: now,
  updatedAt: now,
};

export interface SnippetPreset {
  id: string;
  name: string;
  description: string;
  html: string;
  kind: 'starter' | 'broken';
}

/** The always-available reset target for the editor. */
export const STARTER_PRESET: SnippetPreset = {
  id: 'default-starter',
  name: 'Default / Starter',
  description: 'Reset to the accessible starter snippet.',
  html: SAMPLE_SNIPPET.html,
  kind: 'starter',
};

/** One-click, intentionally broken snippets for demoing the deterministic engine. */
const BROKEN_PRESETS: SnippetPreset[] = [
  {
    id: 'broken-low-contrast-hero',
    kind: 'broken',
    name: 'Low Contrast Hero',
    description: 'Skipped heading level plus pale text on white backgrounds.',
    html: `<section style="background-color: #ffffff; padding: 32px; font-family: system-ui, sans-serif;">
  <h1 style="color: #111827; font-size: 32px;">Ship accessible UI faster</h1>
  <h3 style="color: #111827; margin-top: 8px;">Why teams choose A11y Lens</h3>
  <p style="color: #cccccc; background-color: #ffffff; padding: 12px;">
    This subtitle is almost invisible against its white background.
  </p>
  <button style="color: #eeeeee; background-color: #ffffff; border: 1px solid #e5e7eb; padding: 8px 16px; margin-top: 12px;">
    Learn more
  </button>
</section>`,
  },
  {
    id: 'broken-inaccessible-form',
    kind: 'broken',
    name: 'Inaccessible Form',
    description: 'Unlabeled inputs, an unnamed icon button/link, and an image without alt.',
    html: `<form style="background-color: #ffffff; padding: 24px; font-family: system-ui, sans-serif;">
  <h2 style="color: #111827;">Create your account</h2>
  <input type="text" placeholder="Email address" style="color: #222222; background-color: #ffffff; padding: 8px; margin-top: 12px;" />
  <input type="password" placeholder="Password" style="color: #222222; background-color: #ffffff; padding: 8px; margin-top: 8px;" />
  <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60" style="height: 80px; margin-top: 12px;" />
  <button type="submit" style="color: #ffffff; background-color: #4f46e5; padding: 8px 16px; margin-top: 12px;">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 8h12M8 2v12" /></svg>
  </button>
  <a href="#" style="color: #4f46e5; margin-left: 12px;"></a>
</form>`,
  },
  {
    id: 'broken-modal',
    kind: 'broken',
    name: 'Broken Modal',
    description: 'Dialog with a heading jump, missing alt, low contrast, and unnamed actions.',
    html: `<div role="dialog" aria-modal="true" style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; font-family: system-ui, sans-serif;">
  <h2 style="color: #111827;">Delete this project?</h2>
  <h4 style="color: #111827; margin-top: 4px;">This action cannot be undone</h4>
  <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60" style="width: 100%; margin-top: 12px;" />
  <p style="color: #bbbbbb; background-color: #ffffff;">All data will be permanently removed.</p>
  <button style="color: #ffffff; background-color: #ffffff; border: 1px solid #e5e7eb; padding: 8px 16px;">Cancel</button>
  <button style="color: #ffffff; background-color: #dc2626; padding: 8px 16px; margin-left: 8px;">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 3l10 10M13 3L3 13" /></svg>
  </button>
</div>`,
  },
];

/** Starter first so it is always visible and available as a reset action. */
export const ALL_PRESETS: SnippetPreset[] = [STARTER_PRESET, ...BROKEN_PRESETS];

