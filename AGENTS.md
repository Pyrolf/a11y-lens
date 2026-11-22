# Project: A11y-Lens (Client-Side WCAG & Design Token Auditor)

## Environment & Stack
- Runtime: Node.js v26.13.1
- Framework: React 19, TypeScript (strict), Vite, Tailwind CSS v4, Lucide Icons
- E2E Testing: Playwright (`npx playwright test`)

## Strict Rules
1. 100% Client-Side: Zero backend servers, databases, or paid APIs.
2. Isolated Sandbox: Render user HTML/Tailwind snippets inside an `<iframe>` (`srcDoc`) so user CSS never leaks into the main app UI.
3. Deterministic Engine First: Run pure TypeScript WCAG checks (luminance contrast ratios >= 4.5:1, missing `alt`, missing button/link/input accessible names, heading order) locally before offering AI fixes.
4. BYOK + Zero-Key Demo Mode: Support optional OpenRouter API keys or local Ollama (`http://localhost:11434`) stored in `sessionStorage` only, plus a "Try Demo AI Fix (No Key Required)" fallback so recruiters can test the diff view immediately.
5. Verification: Run `npm run build` and verify UI flows with Playwright MCP or `npx playwright test` before finishing any feature slice.

## AI-Native Workflow
- Primary agents: `plan` for architecture and multi-file design; `build` for implementation.
- Subagents: `explore` for read-only discovery, `reviewer` for diff review, `security` for sandbox/CSP/LLM boundaries, and `qa` for Playwright MCP UI verification.
- Slash commands: `/verify` (full gate), `/review` (diff review), `/qa` (browser smoke), `/security-review` (security audit), and `/eval` (AI-fix eval harness).
- Every new pure function or deterministic rule ships with a Vitest unit test in `tests/unit/`.
- Every new AI-fix behavior adds an eval fixture in `tests/evals/` and keeps the aggregate pass rate at or above 87.5%.
- Before declaring a slice done: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit:coverage`, `npm run test:evals`, and `npm run test:e2e` must all pass. Then run `/qa` against the dev server.
- Never write API keys to disk. OpenRouter/Ollama credentials stay in `sessionStorage` only.
