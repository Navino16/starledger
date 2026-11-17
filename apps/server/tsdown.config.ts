import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  target: 'node26',
  platform: 'node',
  clean: true,
  fixedExtension: false,
  deps: { neverBundle: ['@node-rs/argon2', 'pg'], alwaysBundle: ['@app/shared'] },
});
