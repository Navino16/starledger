import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
let outDir: string;
let script: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'starledger-build-'));
  await build({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  });
  script = readFileSync(join(outDir, 'starledger.user.js'), 'utf8');
});

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('built userscript', () => {
  it('has a header with the PTS-only match', () => {
    expect(script).toContain('// ==UserScript==');
    expect(script).toMatch(/@match\s+https:\/\/s808-en\.ogame\.gameforge\.com\/game\/index\.php\*/);
    expect(script).not.toMatch(/@match.*\*\.ogame/);
  });

  it('declares exactly the allowed grants', () => {
    const grants = [...script.matchAll(/@grant\s+(\S+)/g)].map((m) => m[1]).sort();
    expect(grants).toEqual(
      [
        'GM_addStyle',
        'GM_getValue',
        'GM_registerMenuCommand',
        'GM_setValue',
        'GM_xmlhttpRequest',
        'unsafeWindow',
      ].sort(),
    );
  });

  it('runs in the top frame only', () => {
    expect(script).toMatch(/@noframes/);
  });

  it('keeps the compliance markers in the built file', () => {
    expect(script).toContain(
      'GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3',
    );
    expect(script).toContain('AGENTS.md §5');
    expect(script).toContain('AGENTS.md §1.9');
    expect(script).toContain('AGENTS.md §1.9: consent re-read before every enqueue');
    expect(script).toContain(
      'AGENTS.md §4: our server only, after a player-triggered response, no game request',
    );
    expect(script).toContain("AGENTS.md §4: our errors must never break the game's ajax chain");
    expect(script).toContain('AGENTS.md §4: passive read of page globals, no game function called');
    expect(script).toContain(
      'AGENTS.md §4: passive read of a player-triggered response, no game request',
    );
  });

  it('is not minified', () => {
    const lines = script.split('\n');
    expect(lines.reduce((n, l) => n + l.length, 0) / lines.length).toBeLessThan(200);
  });
});
