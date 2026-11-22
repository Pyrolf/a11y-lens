import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/evals/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/utils/colorMath.ts',
        'src/utils/wcagAuditor.ts',
        'src/engine/tokens/tokenAudit.ts',
        'src/engine/ai/sanitizeLlmHtml.ts',
        'src/engine/ai/postProcessLlmHtml.ts',
        'src/engine/ai/normalizeHeadingOrder.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 75,
      },
    },
  },
});
