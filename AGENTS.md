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
