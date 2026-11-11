import type { AccountRef, StatsResponse } from '@app/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { type MemoryGm, memoryGm } from '../src/gm';
import { createT } from '../src/i18n';
import { saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';
import { DETAILS_ID, openDetails } from '../src/ui/details';

const ACCOUNT: AccountRef = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Neo' };
const t = createT('en');
const res = (metal: number, crystal: number, deuterium: number) => ({ metal, crystal, deuterium });

const statsOf = (patch: { unrecognized?: number; conflictCount?: number } = {}): StatsResponse =>
  ({
    period: 'day',
    range: null,
    generatedAt: 1,
    counts: { unrecognized: patch.unrecognized ?? 0 },
    settings: {},
    summary: {
      conflictCount: patch.conflictCount ?? 0,
      fuel: { recorded: 777, departures: 3, unknownCount: 0 },
      expeditions: {
        outcomes: { resources: 3, nothing: 1, ships: 0 },
        shipsFound: { '202': 5 },
        shipsLost: { '202': 2, '203': 1 },
      },
      balance: {
        expeditions: { gains: res(1000, 2000, 3000), losses: res(10, 20, 30) },
        combats: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        recycling: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        wreckfields: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        fuel: { gains: res(0, 0, 0), losses: res(0, 0, 777) },
      },
    },
  }) as unknown as StatsResponse;

describe('stats details dialog', () => {
  let gm: MemoryGm;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const open = () =>
    openDetails(
      { gm, doc: document, t, queue: createQueue(gm) },
      { account: ACCOUNT, serverUtcOffsetMinutes: 0 },
    );
  const dialog = () => document.getElementById(DETAILS_ID);
  const stats = () => gm.requests.filter((r) => r.url.includes('/api/v1/stats'));

  beforeEach(() => {
    gm = memoryGm();
    document.body.innerHTML = '<div id="links"></div><div id="footer"></div>';
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    gm.respondWith(() => ({ status: 200, body: JSON.stringify(statsOf()) }));
  });

  it('requests the day on open and the week on click with the right today', async () => {
    open();
    await tick();
    expect(stats()).toHaveLength(1);
    expect(stats()[0]?.url).toContain('period=day');
    dialog()?.querySelector<HTMLElement>('[data-period="week"]')?.click();
    await tick();
    expect(stats()).toHaveLength(2);
    expect(stats()[1]?.url).toMatch(/period=week&today=\d{4}-\d{2}-\d{2}/);
  });

  it('shows outcome percentages, ships by id and a separate gains/losses/fuel table', async () => {
    open();
    await tick();
    const text = dialog()?.textContent ?? '';
    expect(text).toContain('Resources: 3 (75%)');
    expect(text).toContain('Nothing: 1 (25%)');
    expect(text).not.toContain('Ships:');
    const shipRows = [...(dialog()?.querySelectorAll('.starledger-ships tr') ?? [])].map(
      (r) => r.textContent,
    );
    expect(shipRows).toContain('20252');
    expect(shipRows).toContain('20301');
    const heads = [...(dialog()?.querySelectorAll('.starledger-balance th') ?? [])].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual(['Category', 'Gains', 'Losses', 'Fuel']);
    const exp = dialog()?.querySelectorAll('[data-category="expeditions"] td');
    expect(exp?.[1]?.textContent).toContain('M 1k');
    expect(exp?.[2]?.textContent).toContain('M 10');
    expect(dialog()?.querySelector('[data-category="fuel"] td:nth-child(4)')?.textContent).toBe(
      '777',
    );
    expect(text).toContain(t('balanceScope'));
  });

  it('shows unrecognized and conflict lines only when above 0', async () => {
    open();
    await tick();
    expect(dialog()?.textContent).not.toContain('unrecognized');
    expect(dialog()?.textContent).not.toContain('conflicts');
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify(statsOf({ unrecognized: 3, conflictCount: 2 })),
    }));
    dialog()?.querySelector<HTMLElement>('[data-period="all"]')?.click();
    await tick();
    expect(dialog()?.textContent).toContain('3 unrecognized reports');
    expect(dialog()?.textContent).toContain('2 conflicts');
  });

  it('closes on Escape, backdrop click and the close button, removing its listener', async () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
    open();
    dialog()?.click();
    expect(dialog()).toBeNull();
    open();
    dialog()
      ?.querySelector('.starledger-dialog')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog()).not.toBeNull();
    [...(dialog()?.querySelectorAll('button') ?? [])]
      .find((b) => b.textContent === 'Close')
      ?.click();
    expect(dialog()).toBeNull();
    await tick();
    expect(document.body.innerHTML).toBe('<div id="links"></div><div id="footer"></div>');
  });

  it('shows the translated error and handles a missing configuration without requesting', async () => {
    gm.respondWith(() => ({ status: 401, body: '' }));
    open();
    await tick();
    expect(dialog()?.textContent).toContain('Invalid key');
    saveSettings(gm, { consent: false });
    const before = gm.requests.length;
    dialog()?.querySelector<HTMLElement>('[data-period="month"]')?.click();
    await tick();
    expect(gm.requests).toHaveLength(before);
    expect(dialog()?.textContent).toContain('Server URL or key missing');
  });

  it('ignores a response arriving after a newer period or after close', async () => {
    const pending: ((v: { status: number; body: string }) => void)[] = [];
    gm.respondWith(() => new Promise((r) => pending.push(r)));
    open();
    dialog()?.querySelector<HTMLElement>('[data-period="week"]')?.click();
    await tick();
    pending[1]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 7 })) });
    await tick();
    pending[0]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 1 })) });
    await tick();
    expect(dialog()?.textContent).toContain('7 unrecognized');
    expect(dialog()?.textContent).not.toContain('1 unrecognized');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
  });
});
