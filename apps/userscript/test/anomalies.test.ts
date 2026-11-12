import { anomalyActionObservationSchema } from '@app/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAnomalyCollector } from '../src/collect/anomalies';

const account = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Zed' };
const ctx = { account, serverUtcOffsetMinutes: 60 };
const url = (action: string, component = 'orion') =>
  `https://s808-en.ogame.gameforge.com/game/index.php?page=ingame&component=${component}&action=${action}&asJson=1`;

type Settings = { url?: string; data?: unknown };
type Handler = (e: unknown, xhr: unknown, settings: Settings) => void;

function setup(scanData: unknown = undefined) {
  const handlers: Record<string, Handler[]> = {};
  const ajax = vi.fn();
  const win = {
    $: Object.assign(
      (target: unknown) => ({
        on: (e: string, h: Handler) => {
          handlers[e] = [...(handlers[e] ?? []), h];
        },
        data: (key: string) =>
          target === '#scanCostValue' && key === 'value' ? scanData : undefined,
      }),
      { ajax },
    ),
  };
  const onObservations = vi.fn();
  installAnomalyCollector(win, { doc: document, ctx, onObservations });
  const run = (settings: Settings, response: unknown = { status: 'success' }, dom?: () => void) => {
    const xhr =
      typeof response === 'string' ? { responseText: response } : { responseJSON: response };
    for (const h of handlers.ajaxSend ?? []) h({}, xhr, settings);
    dom?.();
    for (const h of handlers.ajaxSuccess ?? []) h({}, xhr, settings);
  };
  const obs = (i = 0) => onObservations.mock.calls[i]?.[0][0];
  return { run, onObservations, obs, ajax, handlers };
}

const scanCost = (attrs: string) => {
  document.body.innerHTML = `<span id="scanCostValue" ${attrs}></span>`;
};
const overlay = (cls: string, id: string, extra: string, inner: string) =>
  `<div class="orionCollectRewards ${cls}" data-space-object-id="${id}" ${extra}>${inner}</div>`;

describe('installAnomalyCollector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => vi.restoreAllMocks());

  it('records a scan with the cost from data("value")', () => {
    const { run, obs } = setup(19915);
    run({ url: url('performScan') });
    expect(anomalyActionObservationSchema.safeParse(obs()).success).toBe(true);
    expect(obs()).toMatchObject({
      kind: 'anomaly_action',
      action: 'scan',
      lithium: 19915,
      darkMatter: null,
      lithiumBonus: 0,
      lithiumBonusRaw: null,
      account,
      serverUtcOffsetMinutes: 60,
    });
    expect(Number.isInteger(obs().actedAt)).toBe(true);
  });

  it('falls back to the dot-grouped tooltip title', () => {
    const { run, obs } = setup();
    scanCost('data-tooltip-title="19.915"');
    run({ url: url('performScan') });
    expect(obs().lithium).toBe(19915);
  });

  it('records a null cost when the scan cost is unreadable', () => {
    const { run, obs } = setup();
    run({ url: url('performScan') });
    expect(obs().lithium).toBeNull();
  });

  it('reads the cost at send time, not at success time', () => {
    const { run, obs } = setup();
    scanCost('data-tooltip-title="100"');
    run({ url: url('performScan') }, { status: 'success' }, () => {
      document.body.innerHTML = '';
    });
    expect(obs().lithium).toBe(100);
  });

  it('takes the collect cost from the overlay of the same spaceObjectId', () => {
    const { run, obs } = setup();
    document.body.innerHTML =
      overlay('', '7', '', '<span class="collectTotalValue">48.800</span>') +
      overlay('', '8', '', '<span class="collectTotalValue">1</span>');
    run({ url: url('collectRewards'), data: 'spaceObjectId=7&token=t' });
    expect(obs()).toMatchObject({ action: 'collect', lithium: 48800, darkMatter: null });
  });

  it('records a null cost for another overlay or a direct collect', () => {
    const { run, obs } = setup();
    document.body.innerHTML = overlay('', '8', '', '<span class="collectTotalValue">1</span>');
    run({ url: url('collectRewards'), data: { spaceObjectId: 7 } });
    document.body.innerHTML = '';
    run({ url: url('collectRewards'), data: 'spaceObjectId=7' });
    expect(obs(0).lithium).toBeNull();
    expect(obs(1).lithium).toBeNull();
  });

  it('records a Dark Matter collect with the request price and the floored balance', () => {
    const { run, obs } = setup();
    document.body.innerHTML = '<div class="orionLithiumAmount" data-value="9906.8"></div>';
    run({ url: url('collectRewardsWithDarkMatter'), data: 'spaceObjectId=7&darkMatterPrice=590' });
    run({
      url: url('collectRewardsWithDarkMatter'),
      data: { spaceObjectId: 7, darkMatterPrice: 591 },
    });
    expect(obs(0)).toMatchObject({ action: 'collect_dm', darkMatter: 590, lithium: 9906 });
    expect(obs(1).darkMatter).toBe(591);
  });

  it('falls back to the overlay price, then to null', () => {
    const { run, obs } = setup();
    document.body.innerHTML = overlay(
      'orionCollectRewardsDarkMatter',
      '7',
      'data-dark-matter-price="1399"',
      '',
    );
    run({ url: url('collectRewardsWithDarkMatter'), data: 'spaceObjectId=7&darkMatterPrice=abc' });
    document.body.innerHTML = '';
    run({ url: url('collectRewardsWithDarkMatter'), data: 'spaceObjectId=7' });
    expect(obs(0)).toMatchObject({ darkMatter: 1399, lithium: null });
    expect(obs(1).darkMatter).toBeNull();
  });

  it('maps a null lithiumBonus to 0 and keeps a present one as unknown with its JSON', () => {
    const { run, obs } = setup();
    run(
      { url: url('collectRewards'), data: 'spaceObjectId=7' },
      { status: 'success', lithiumBonus: null },
    );
    run({ url: url('collectRewards'), data: 'spaceObjectId=7' }, { status: 'success' });
    const bonus = { title: 'Bonus', message: 'x' };
    run(
      { url: url('collectRewards'), data: 'spaceObjectId=7' },
      { status: 'success', lithiumBonus: bonus },
    );
    expect(obs(0)).toMatchObject({ lithiumBonus: 0, lithiumBonusRaw: null });
    expect(obs(1)).toMatchObject({ lithiumBonus: 0, lithiumBonusRaw: null });
    expect(obs(2)).toMatchObject({ lithiumBonus: null, lithiumBonusRaw: JSON.stringify(bonus) });
  });

  it('records a null cost when the request carries no spaceObjectId', () => {
    const { run, obs } = setup();
    document.body.innerHTML = overlay('', '7', '', '<span class="collectTotalValue">5</span>');
    run({ url: url('collectRewards') });
    expect(obs().lithium).toBeNull();
  });

  it('drops an oversized lithiumBonus JSON but still emits the observation', () => {
    const { run, obs, onObservations } = setup();
    const bonus = { message: 'x'.repeat(4001) };
    run(
      { url: url('collectRewards'), data: 'spaceObjectId=7' },
      { status: 'success', lithiumBonus: bonus },
    );
    expect(onObservations).toHaveBeenCalledTimes(1);
    expect(obs()).toMatchObject({ lithiumBonus: null, lithiumBonusRaw: null });
  });

  it('parses a JSON responseText body', () => {
    const { run, obs } = setup();
    run({ url: url('performScan') }, '{"status":"success"}');
    expect(obs()).toMatchObject({ action: 'scan' });
  });

  it('records nothing for an error status, bad JSON, or a send that never succeeds', () => {
    const { run, onObservations, handlers } = setup();
    for (const h of handlers.ajaxSend ?? []) h({}, {}, { url: url('performScan') });
    run({ url: url('performScan') }, { status: 'error' });
    run({ url: url('performScan') }, '<html>');
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('ignores unrelated requests', () => {
    const { run, onObservations } = setup();
    run({ url: url('fetchScanCost') });
    run({ url: url('activateMission') });
    run({ url: url('performScan', 'fleetdispatch') });
    run({});
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('never issues a request itself', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { run, ajax } = setup();
    run({ url: url('performScan') });
    expect(ajax).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
