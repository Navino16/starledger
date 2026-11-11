import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/app';
import { memoryGm } from '../src/gm';
import { createT } from '../src/i18n';
import { saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';
import { CLIENT_VERSION } from '../src/version';

const OBSERVATIONS = [
  { clientObservationId: 'a', kind: 'message', msgId: 1 },
  { clientObservationId: 'b', kind: 'message', msgId: 2 },
] as never[];

describe('debug export of the queue', () => {
  let gm: ReturnType<typeof memoryGm>;
  const t = createT('en');
  const win = { serverTime: new Date(), $: undefined } as never;
  let blobs: Blob[];
  let clicked: HTMLAnchorElement[];
  const fetchSpy = vi.fn();

  beforeEach(() => {
    gm = memoryGm();
    document.head.innerHTML =
      '<meta name="ogame-universe" content="s808-en.ogame.gameforge.com"><meta name="ogame-language" content="en"><meta name="ogame-player-id" content="42"><meta name="ogame-player-name" content="Neo">';
    document.body.innerHTML = '<div id="links"></div>';
    blobs = [];
    clicked = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
      expect(document.body.contains(this)).toBe(true);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const exportEntry = () => gm.menus.find((m) => m.label === t('exportLabel'));

  it('registers the entry only with consent', () => {
    main(gm, document, win);
    expect(exportEntry()).toBeUndefined();
    gm.menus.length = 0;
    saveSettings(gm, { consent: true });
    main(gm, document, win);
    expect(exportEntry()).toBeDefined();
  });

  it('downloads the queue as JSON, sends nothing and keeps the queue', async () => {
    saveSettings(gm, { consent: true });
    createQueue(gm).enqueue(OBSERVATIONS);
    main(gm, document, win);
    exportEntry()?.fn();

    expect(blobs).toHaveLength(1);
    const text = await blobs[0]?.text();
    const parsed = JSON.parse(text ?? '');
    expect(parsed.clientVersion).toBe(CLIENT_VERSION);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.observations).toEqual(OBSERVATIONS);
    expect(text).toContain('\n  ');
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toMatch(/^starledger-queue-.+\.json$/);
    expect(clicked[0]?.getAttribute('href')).toBe('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(gm.requests).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createQueue(gm).size()).toBe(2);
  });

  it('exports an empty list when nothing is queued', async () => {
    saveSettings(gm, { consent: true });
    main(gm, document, win);
    exportEntry()?.fn();
    expect(JSON.parse((await blobs[0]?.text()) ?? '').observations).toEqual([]);
  });
});
