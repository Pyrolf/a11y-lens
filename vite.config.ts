import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // axe-core's published browser build is inlined verbatim into the sandbox
    // srcDoc (see SandboxPreview.tsx), so a ~1 MB chunk is intentional here.
    chunkSizeWarningLimit: 1200,
  },
});
