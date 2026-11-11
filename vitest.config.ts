import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    reporters: ['default', 'junit'],
    outputFile: { junit: '.reports/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      reportsDirectory: '.reports/coverage',
    },
  },
});
