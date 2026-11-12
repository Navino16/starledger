import type { AccountRef, ApiError, StatsPeriod, StatsResponse } from '@app/shared';
import { todayKey } from '../env/page';
import { detectLang, errorKey, type MessageKey, type T } from '../i18n';
import { loadSettings } from '../storage';
import { createApi } from '../sync/api';
import { CLIENT_VERSION } from '../version';
import { renderCalendar, shiftMonth } from './details/calendar';
import { renderDonut } from './details/donut';
import { renderShips } from './details/ships';
import { renderNotes, renderTable } from './details/table';
import { el, type UiContext } from './dom';
import type { IconPage } from './icons';
import { openPanel } from './panel';

export const DETAILS_ID = 'starledger-details';

export type DetailsEnv = { account: AccountRef; serverUtcOffsetMinutes: number };

const PERIODS: [StatsPeriod, MessageKey][] = [
  ['day', 'periodDay'],
  ['week', 'periodWeek'],
  ['month', 'periodMonth'],
  ['all', 'periodAll'],
];

function renderContent(doc: Document, t: T, stats: StatsResponse, win?: IconPage): HTMLElement[] {
  const { summary } = stats;
  const nodes: HTMLElement[] = [
    el(
      doc,
      'div',
      { className: 'starledger-split' },
      el(
        doc,
        'section',
        {},
        el(doc, 'h4', { textContent: t('sectionOutcomes') }),
        renderDonut(doc, t, summary.expeditions?.outcomes),
      ),
      el(
        doc,
        'section',
        {},
        el(doc, 'h4', { textContent: t('sectionShips') }),
        renderShips(doc, summary.ships, win),
      ),
    ),
    el(doc, 'h4', { textContent: t('sectionBalance') }),
    renderTable(doc, t, stats, win),
    renderNotes(doc, t, stats),
  ];
  return nodes;
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
    [bar, nav, calendarBox, body],
  );
  const monthFormat = new Intl.DateTimeFormat(detectLang(doc), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const state: { period: StatsPeriod; refDay: string } = {
    period: 'day',
    refDay: todayKey(env.serverUtcOffsetMinutes),
  };
  const monthLabel = el(doc, 'span', { className: 'starledger-month' });
  const isOpen = handle.isOpen;
  let seq = 0;

  const showError = (error: ApiError) => {
    calendarBox.replaceChildren();
    body.replaceChildren(
      el(doc, 'p', {
        className: 'starledger-error',
        textContent: t('statusError', { error: t(errorKey(error)) }),
      }),
    );
  };

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

  async function load(before?: Promise<unknown>): Promise<void> {
    const mine = ++seq;
    const { period, refDay } = state;
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
    });
    if (!isOpen() || mine !== seq) return;
    if (!loadSettings(gm).consent) {
      showError('not_configured');
      return;
    }
    if (!result.ok) {
      showError(result.error);
      return;
    }
    try {
      calendarBox.replaceChildren(
        renderCalendar(doc, result.data.days, refDay, (day) =>
          change({ period: 'day', refDay: day }),
        ),
      );
      body.replaceChildren(...renderContent(doc, t, result.data, ctx.win));
    } catch {
      showError('server_error');
    }
  }

  function change(next: Partial<typeof state>): void {
    const merged = { ...state, ...next };
    if (merged.period === state.period && merged.refDay === state.refDay) return;
    Object.assign(state, merged);
    void load();
  }

  const navButton = (dir: 'prev' | 'next', key: MessageKey, delta: number) => {
    const b = el(doc, 'button', { type: 'button', textContent: dir === 'prev' ? '‹' : '›' });
    b.title = t(key);
    b.setAttribute('aria-label', t(key));
    b.dataset.nav = dir;
    b.addEventListener('click', () => change({ refDay: shiftMonth(state.refDay, delta) }));
    return b;
  };
  nav.append(navButton('prev', 'prevMonth', -1), monthLabel, navButton('next', 'nextMonth', 1));

  for (const [period, key] of PERIODS) {
    const b = el(doc, 'button', { type: 'button', textContent: t(key) });
    b.dataset.period = period;
    b.addEventListener('click', () => change({ period }));
    buttons.set(period, b);
    bar.append(b);
  }

  void load(ready());
}
