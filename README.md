# A11y-Lens

A client-side WCAG & design-token auditor for HTML/Tailwind snippets. Paste markup, see deterministic accessibility findings and extracted design tokens immediately, then optionally review an AI-suggested fix. **No backend, database, or paid API — everything runs in the browser.**

## Why it stands out

- **Deterministic first, AI second.** Eight pure-TypeScript WCAG checks run locally on every edit using real WCAG 2.x relative-luminance math (≥ 4.5:1 normal text, ≥ 3:1 large text), and `axe-core` WCAG 2.0/2.1 A/AA plus best-practice rules run inside the sandbox and merge into the same report. AI is an optional, reviewable diff — never the source of truth.
- **Safe preview by construction.** User HTML renders in an `<iframe srcDoc>` with `sandbox="allow-scripts"` and **no** `allow-same-origin`. The frame gets an opaque origin: it cannot touch app DOM, cookies, or `sessionStorage`. Computed styles cross the boundary only through a validated `postMessage` probe.
- **Recruiter-friendly demo.** “Try Demo AI Fix (No Key Required)” produces a deterministic patch and before/after diff instantly. BYOK providers (OpenRouter or local Ollama) are available but never required; keys live in `sessionStorage` only. OpenRouter defaults to the official `openrouter/free` $0 auto-router, keeps curated free-model picks as an offline fallback, and can refresh live $0 `:free` models from OpenRouter's public model catalog.
- **Smart, honest model discovery.** OpenRouter's catalog is filtered to $0 models, ranked by coding/agentic affinity and then context window, cached for five minutes, and refreshed on demand; congested families are hidden unless typed manually. Ollama probes `/api/tags` and distinguishes `connected`, `empty`, and `offline`, so fallback suggestions are never mislabeled as installed. Both dropdowns render one grouped section plus a custom-model option.
- **Clean token extraction.** Only elements from the user snippet are inspected. Transparent backgrounds are dropped, effective backgrounds stay internal to contrast math (no duplicate rows), and every color is shown as uppercase `#HEX` plus its original `rgb()` with an “N elements” usage badge.

## Architecture decisions

| Area | Decision | Rationale |
| --- | --- | --- |
| Isolation | `<iframe srcDoc sandbox="allow-scripts">`, no `allow-same-origin` | Untrusted snippets can render and run their own scripts but cannot escape to the parent origin. The parent never reads `contentDocument`. |
| Style resolution | Tailwind CDN inside the sandbox + a generated deterministic utility stylesheet | Live previews look right online; computed styles still work offline and in CI. |
| Audit engine | `src/utils/colorMath.ts` + `src/utils/wcagAuditor.ts` | Pure functions, no DOM globals in the math, so results are reproducible and unit-testable. |
| Browser-based rules | `axe-core` injected into the sandboxed iframe | Adds real WCAG 2.0/2.1 A/AA and best-practice coverage; violations cross the opaque-origin boundary as validated `postMessage` payloads and are deduplicated against the custom rules. |
| Computed colors | In-frame probe → `postMessage` → parent | Bypasses the opaque-origin restriction while preserving inherited backgrounds, CSS variables and Tailwind v4 utilities. |
| Tokens | Source pass + computed pass, de-duplicated by role and color value | Clean UI tokens with accurate usage counts; internal effective backgrounds used only for contrast. |
| AI providers | Demo / OpenRouter / Ollama behind one hook | Zero-key path always works; real providers stay opt-in and session-scoped. |
| Resilience | `WorkbenchErrorBoundary` + soft-failing JSON parser | Malformed tokens or unexpected DOM input show a recovery banner instead of a blank screen. |
| Accessibility of the tool itself | Skip link, visible focus rings, `aria-live` audit counts, keyboard-operable tabs and modal | The auditor is held to the same standard it enforces. |

### Code map

- `src/utils/colorMath.ts` — color parsing, compositing, WCAG luminance/contrast.
- `src/utils/wcagAuditor.ts` — the eight-rule deterministic engine.
- `src/engine/audit` / `src/engine/tokens` — audit and token pipelines.
- `src/components/preview/SandboxPreview.tsx` — sandboxed iframe, `axe-core` injection and computed-style probe.
- `src/components/layout/WorkbenchErrorBoundary.tsx` — recovery banner.
- `src/engine/ai` — demo, OpenRouter and Ollama providers plus the line diff.
- `src/lib/sampleSnippets.ts` / `sampleTokens.ts` — presets used by the E2E suite.

## Local setup

Requires **Node.js 26.13.1** (see `.github/workflows/ci.yml`).

```bash
npm ci
npm run dev        # http://localhost:5173
```

No environment variables are needed. Optional AI credentials can be entered in the UI's AI Fix drawer.

## Testing & verification

```bash
npm run typecheck        # strict TypeScript (app + node configs)
npm run lint             # oxlint
npm run build            # typecheck + production bundle
npx playwright install --with-deps chromium
npm run test:e2e         # full Playwright suite
npm run test:e2e:ui      # interactive Playwright UI
```

The Playwright config starts Vite automatically. The suite contains 77 E2E tests across 12 spec files, covering the deterministic rules, axe-backed coverage, all presets, live edits, tokens, and AI providers. CI runs the same sequence on Node 26.13.1 for every push and pull request.

## Accessibility rules checked

1. Text contrast (4.5:1 normal, 3:1 large)
2. Image alternative text
3. Button/link accessible names
4. Form control labels
5. Heading order and duplicate `h1`
6. Vague link text
7. Positive `tabindex`
8. Suppressed focus outlines without a `:focus-visible` replacement

In addition to these eight custom families, `axe-core` reports WCAG 2.0/2.1 A/AA and best-practice violations from the rendered sandbox document; findings are deduplicated and shown alongside the deterministic results.
