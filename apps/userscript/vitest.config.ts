import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __CLIENT_VERSION__: JSON.stringify(pkg.version) },
  test: { environment: 'jsdom', testTimeout: 30_000 },
});
