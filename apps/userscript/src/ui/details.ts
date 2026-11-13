import type { AccountRef, ApiError, DayRange, StatsPeriod, StatsResponse } from '@app/shared';
import { todayKey } from '../env/page';
import { detectLang, errorKey, type MessageKey, type T } from '../i18n';
import { loadSettings } from '../storage';
import { createApi } from '../sync/api';
import { CLIENT_VERSION } from '../version';
import { renderCalendar, shiftMonth } from './details/calendar';
import { renderDonut } from './details/donut';
import { renderShips } from './details/ships';
import { renderTable } from './details/table';
import { el, type UiContext } from './dom';
import { openPanel } from './panel';

export const DETAILS_ID = 'starledger-details';

export type DetailsEnv = { account: AccountRef; serverUtcOffsetMinutes: number };

const PERIODS: [StatsPeriod, MessageKey, MessageKey][] = [
  ['day', 'periodDay', 'periodDayShort'],
  ['week', 'periodWeek', 'periodWeekShort'],
  ['month', 'periodMonth', 'periodMonthShort'],
  ['all', 'periodAll', 'periodAllShort'],
];

function dateLabel(doc: Document, t: T, stats: StatsResponse, refDay: string): string {
  const lang = detectLang(doc);
  const format = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(
      new Date(`${day}T00:00:00Z`),
    );
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (stats.period === 'day') return format(refDay, full);
  if (stats.period === 'custom' && stats.range) {
    const date = (day: string) => new Date(`${day}T00:00:00Z`);
    return new Intl.DateTimeFormat(lang, { ...full, timeZone: 'UTC' }).formatRange(
      date(stats.range.from),
      date(stats.range.to),
    );
  }
  if (stats.period === 'month') return format(refDay, { month: 'long', year: 'numeric' });
  if (stats.range) return `${format(stats.range.from, full)} – ${format(stats.range.to, full)}`;
  return t(stats.period === 'week' ? 'periodWeek' : 'periodAll');
}

function renderDateLine(doc: Document, t: T, stats: StatsResponse, refDay: string): HTMLElement {
  return el(
    doc,
    'div',
    { className: 'starledger-dateline' },
    el(doc, 'strong', { textContent: dateLabel(doc, t, stats, refDay) }),
  );
}

function renderContent(doc: Document, t: T, stats: StatsResponse, refDay: string): HTMLElement[] {
  const { summary } = stats;
  const section = (label: MessageKey, className: string, child: HTMLElement) => {
    const node = el(doc, 'section', { className }, child);
    node.setAttribute('aria-label', t(label));
    return node;
  };
  return [
    renderDateLine(doc, t, stats, refDay),
    el(
      doc,
      'div',
      { className: 'starledger-split' },
      section(
        'sectionOutcomes',
        'starledger-card',
        renderDonut(doc, t, summary.expeditions?.outcomes),
      ),
      section('sectionShips', 'starledger-ships', renderShips(doc, summary.ships)),
    ),
    section('sectionBalance', 'starledger-balancewrap', renderTable(doc, t, stats)),
  ];
}

export function openDetails(ctx: UiContext, env: DetailsEnv): void {
  const { doc, gm, t } = ctx;
  const body = el(doc, 'div', { className: 'starledger-dialog-body' });
  const buttons = new Map<StatsPeriod, HTMLButtonElement>();
  const bar = el(doc, 'div', { className: 'starledger-periods' });
  const nav = el(doc, 'div', { className: 'starledger-monthnav' });
  const calendarBox = el(doc, 'div', {});
  const handle = openPanel(
    doc,
    { id: DETAILS_ID, title: t('detailsTitle'), closeLabel: t('close'), closeOnOutside: true },
    [el(doc, 'div', { className: 'starledger-toolbar' }, bar, nav), calendarBox, body],
  );
  const monthFormat = new Intl.DateTimeFormat(detectLang(doc), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const state: { period: StatsPeriod; refDay: string; range?: DayRange } = {
    period: 'day',
    refDay: todayKey(env.serverUtcOffsetMinutes),
  };
  const monthLabel = el(doc, 'span', { className: 'starledger-month' });
  const isOpen = handle.isOpen;
  let seq = 0;

  const showMessage = (text: string) => {
    calendarBox.replaceChildren();
    body.replaceChildren(el(doc, 'p', { className: 'starledger-error', textContent: text }));
  };
  const showError = (error: ApiError) =>
    showMessage(t('statusError', { error: t(errorKey(error)) }));

  const ready = (): Promise<unknown> => {
    const settings = loadSettings(gm);
    if (!settings.consent || !settings.serverUrl || !settings.apiKey) return Promise.resolve();
    //! AGENTS.md §4: flush on detail open (spec §4.1), our server only, no game request
    return ctx.queue
      .flush(
        createApi(gm, settings, CLIENT_VERSION),
        settings.deviceId,
        () => loadSettings(gm).consent,
      )
      .then(() => {
        if (isOpen()) ctx.refreshBox?.();
      })
      .catch(() => {});
  };

  const renderMonthLabel = () => {
    monthLabel.textContent = monthFormat.format(
      new Date(`${state.refDay.slice(0, 7)}-01T00:00:00Z`),
    );
  };

  async function load(before?: Promise<unknown>, refocus = false): Promise<void> {
    const mine = ++seq;
    const { period, refDay, range } = state;
    for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === period));
    renderMonthLabel();
    body.replaceChildren(el(doc, 'p', { textContent: t('loading') }));
    await before;
    if (!isOpen() || mine !== seq) return;
    const settings = loadSettings(gm);
    //! AGENTS.md §1.9: consent and configuration re-checked before every request
    if (!settings.consent || !settings.serverUrl || !settings.apiKey) {
      showError('not_configured');
      return;
    }
    //! AGENTS.md §4: user-triggered, our server only, no game request, no timer
    const result = await createApi(gm, settings, CLIENT_VERSION).getStats({
      serverId: env.account.serverId,
      lang: env.account.lang,
      playerId: env.account.playerId,
      period,
      today: refDay,
      ...(period === 'custom' ? range : undefined),
    });
    if (!isOpen() || mine !== seq) return;
    if (!loadSettings(gm).consent) {
      showError('not_configured');
      return;
    }
    if (!result.ok) {
      // Spec 2026-11-13 "Older server": a server without custom periods rejects the query
      if (period === 'custom' && result.error === 'invalid_payload') {
        showMessage(t('customPeriodUnsupported'));
      } else showError(result.error);
      return;
    }
    try {
      calendarBox.replaceChildren(
        renderCalendar(
          doc,
          result.data.days,
          refDay,
          (day) => change({ period: 'day', refDay: day, range: undefined }, true),
          period === 'all' ? 'all' : (result.data.range ?? undefined),
          (span) => change({ period: 'custom', range: span }),
        ),
      );
      body.replaceChildren(...renderContent(doc, t, result.data, refDay));
      if (refocus) calendarBox.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    } catch {
      showError('server_error');
    }
  }

  function change(next: Partial<typeof state>, refocus = false): void {
    const merged = { ...state, ...next };
    if (
      merged.period === state.period &&
      merged.refDay === state.refDay &&
      merged.range?.from === state.range?.from &&
      merged.range?.to === state.range?.to
    ) {
      return;
    }
    Object.assign(state, merged);
    void load(undefined, refocus);
  }

  const navButton = (dir: 'prev' | 'next', key: MessageKey, delta: number) => {
    const b = el(doc, 'button', { type: 'button', textContent: dir === 'prev' ? '‹' : '›' });
    b.title = t(key);
    b.setAttribute('aria-label', t(key));
    b.dataset.nav = dir;
    b.addEventListener('click', () => {
      const refDay = shiftMonth(state.refDay, delta);
      // Spec 2026-11-13: a span of the old month would not be visible, so show the whole new month
      change(
        state.period === 'custom' ? { period: 'month', refDay, range: undefined } : { refDay },
      );
    });
    return b;
  };
  nav.append(navButton('prev', 'prevMonth', -1), monthLabel, navButton('next', 'nextMonth', 1));

  for (const [period, key, shortKey] of PERIODS) {
    const b = el(doc, 'button', { type: 'button', textContent: t(shortKey), title: t(key) });
    b.setAttribute('aria-label', t(key));
    b.dataset.period = period;
    b.addEventListener('click', () => change({ period, range: undefined }));
    buttons.set(period, b);
    bar.append(b);
  }

  void load(ready());
}
