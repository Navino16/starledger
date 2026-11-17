import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// jest-dom 7 augments vitest's Assertion, which Vitest 5 only re-exports; Matchers is the supported hook.
declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: mirrors Vitest's own Matchers signature
  interface Matchers<T = any> extends TestingLibraryMatchers<unknown, T> {}
}
