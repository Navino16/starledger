import type { AccountRef, ApiError, Observation } from '@app/shared';
import { installAnomalyCollector } from './collect/anomalies';
import { type FleetPageWindow, installFleetCollector } from './collect/fleet';
import { installMessageCollector } from './collect/messages';
import { readAccount, readServerUtcOffset, todayKey } from './env/page';
import type { Gm } from './gm';
import { createT, detectLang } from './i18n';
import { isAllowedUniverse } from './pts-guard';
import { loadSettings, loadStatsCache, saveStatsCache } from './storage';
import { createApi } from './sync/api';
import { createQueue } from './sync/queue';
import { mountStatsBox } from './ui/box';
import { renderConsent } from './ui/consent';
import { openDetails } from './ui/details';
import type { UiContext } from './ui/dom';
import { exportQueue } from './ui/export';
import type { IconPage } from './ui/icons';
import { setOglightHidden } from './ui/oglight';
import { renderOptions } from './ui/options';
import { UI_CSS } from './ui/styles';
import { CLIENT_VERSION } from './version';

export function main(
  gm: Gm,
  doc: Document,
  win?: FleetPageWindow & IconPage & { serverTime?: unknown },
  onCollected: () => void = () => {},
): void {
  //! AGENTS.md §4: our errors must never break the game's page or its ajax chain
  try {
    bootstrap(gm, doc, win, onCollected);
  } catch {}
}

function bootstrap(
  gm: Gm,
  doc: Document,
  win?: FleetPageWindow & IconPage & { serverTime?: unknown },
  onCollected: () => void = () => {},
): void {
  if (!isAllowedUniverse(doc)) return;

  const lang = detectLang(doc);
  const ctx: UiContext = { gm, doc, t: createT(lang), queue: createQueue(gm), win };
  gm.addStyle(UI_CSS);

  const openOptions = () => renderOptions(ctx);
  const openConsent = () => renderConsent(ctx, openOptions);
  const open = () => (loadSettings(gm).consent ? openOptions() : openConsent());

  gm.menu(ctx.t('menuLabel'), open);

  const account = win ? readAccount(doc) : null;
  const serverUtcOffsetMinutes = win ? readServerUtcOffset(win) : null;
  const cached = account ? loadStatsCache(gm, account) : null;
  let box = {
    stats: cached?.stats ?? null,
    statsAt: cached?.at ?? null,
    stale: cached !== null,
    statsError: null as ApiError | null,
  };

  const refreshBox = () => {
    const current = loadSettings(gm);
    mountStatsBox(
      doc,
      {
        state: ctx.queue.state(),
        ...box,
        configured: Boolean(current.serverUrl && current.apiKey),
        consent: current.consent,
      },
      {
        t: ctx.t,
        onConfigure: current.consent ? openOptions : openConsent,
        onOpenDetails: () => {
          if (account && serverUtcOffsetMinutes !== null) {
            openDetails(ctx, { account, serverUtcOffsetMinutes });
          }
        },
      },
    );
  };
  ctx.refreshBox = refreshBox;

  async function refreshStats(known: AccountRef, offset: number): Promise<void> {
    const current = loadSettings(gm);
    //! AGENTS.md §1.9: no request to our server without consent
    if (!current.consent || !current.serverUrl || !current.apiKey) return;
    //! AGENTS.md §4: our server only, after a flush, no game request
    const result = await createApi(gm, current, CLIENT_VERSION).getStats({
      serverId: known.serverId,
      lang: known.lang,
      playerId: known.playerId,
      period: 'day',
      today: todayKey(offset),
    });
    //! AGENTS.md §1.9: consent re-read after the await, nothing cached or shown if withdrawn
    if (!loadSettings(gm).consent) return;
    if (result.ok) {
      saveStatsCache(gm, known, result.data, Date.now());
      box = { stats: result.data, statsAt: Date.now(), stale: false, statsError: null };
    } else {
      const fallback = loadStatsCache(gm, known);
      box = {
        stats: fallback?.stats ?? null,
        statsAt: fallback?.at ?? null,
        stale: fallback !== null,
        statsError: result.error,
      };
    }
    refreshBox();
  }

  const syncThenStats = (api: ReturnType<typeof createApi>, deviceId: string) => {
    const flushed = ctx.queue.flush(api, deviceId, () => loadSettings(gm).consent);
    return flushed.then(() => {
      refreshBox();
      if (account && serverUtcOffsetMinutes !== null) {
        return refreshStats(account, serverUtcOffsetMinutes);
      }
    });
  };

  const settings = loadSettings(gm);
  refreshBox();
  if (!settings.consent) {
    //! AGENTS.md §1.9: nothing is collected or sent before explicit consent
    return;
  }

  //! AGENTS.md §1.9: local export of already-collected data, nothing is sent
  gm.menu(ctx.t('exportLabel'), () => {
    try {
      exportQueue(doc, ctx.queue.items(), CLIENT_VERSION);
    } catch {}
  });

  setOglightHidden(gm, doc, settings.hideOglightBox);

  if (win && account && serverUtcOffsetMinutes !== null) {
    // Unknown is not 0: without both, nothing is collected
    const onObservations = (observations: Observation[]) => {
      const current = loadSettings(gm);
      //! AGENTS.md §1.9: consent re-read before every enqueue
      if (!current.consent) return;
      const { accepted } = ctx.queue.enqueue(observations);
      if (accepted === 0) return;
      refreshBox();
      if (current.serverUrl && current.apiKey) {
        //! AGENTS.md §4: our server only, after a player-triggered response, no game request
        void syncThenStats(createApi(gm, current, CLIENT_VERSION), current.deviceId).catch(
          () => {},
        );
      }
      onCollected();
    };
    const collectorDeps = { doc, ctx: { account, serverUtcOffsetMinutes }, onObservations };
    installMessageCollector(win, collectorDeps);
    installFleetCollector(win, collectorDeps);
    installAnomalyCollector(win, collectorDeps);
  }

  if (settings.serverUrl && settings.apiKey) {
    //! AGENTS.md §4: our server only, on page load, no game request
    void syncThenStats(createApi(gm, settings, CLIENT_VERSION), settings.deviceId).catch(() => {});
  }
}
