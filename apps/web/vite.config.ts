import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Readable bundle: the server and its front are part of the toleration review (AGENTS.md §0, §5).
  build: { minify: false, outDir: 'dist' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
