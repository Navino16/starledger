import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no layout: Recharts' ResponsiveContainer measures its box once, so give it a size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
const box = { width: 640, height: 220, top: 0, left: 0, right: 640, bottom: 220, x: 0, y: 0 };
HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { ...box, toJSON: () => box } as DOMRect;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
