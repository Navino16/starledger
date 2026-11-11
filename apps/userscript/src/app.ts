import { installMessageCollector, type PageWindow } from './collect/messages';
import { readAccount, readServerUtcOffset } from './env/page';
import type { Gm } from './gm';
import { createT, detectLang } from './i18n';
import { isAllowedUniverse } from './pts-guard';
import { loadSettings } from './storage';
import { createApi } from './sync/api';
import { createQueue } from './sync/queue';
import { renderConfigureBox, renderConsent } from './ui/consent';
import type { UiContext } from './ui/dom';
import { setOglightHidden } from './ui/oglight';
import { renderOptions } from './ui/options';
import { UI_CSS } from './ui/styles';
import { CLIENT_VERSION } from './version';

export function main(
  gm: Gm,
  doc: Document,
  win?: PageWindow & { serverTime?: unknown },
  onCollected: () => void = () => {},
): void {
  if (!isAllowedUniverse(doc)) return;

  const lang = detectLang(doc);
  const ctx: UiContext = { gm, doc, t: createT(lang), queue: createQueue(gm) };
  gm.addStyle(UI_CSS);

  const openOptions = () => renderOptions(ctx);
  const openConsent = () => renderConsent(ctx, openOptions);
  const open = () => (loadSettings(gm).consent ? openOptions() : openConsent());

  gm.menu(ctx.t('menuLabel'), open);

  const settings = loadSettings(gm);
  if (!settings.consent) {
    //! AGENTS.md §1.9: nothing is collected or sent before explicit consent
    renderConfigureBox(ctx, openConsent);
    return;
  }

  setOglightHidden(gm, doc, settings.hideOglightBox);

  if (win) {
    const account = readAccount(doc);
    const serverUtcOffsetMinutes = readServerUtcOffset(win);
    // Unknown is not 0: without both, nothing is collected
    if (account && serverUtcOffsetMinutes !== null) {
      installMessageCollector(win, {
        ctx: { account, serverUtcOffsetMinutes },
        onObservations: (observations) => {
          const current = loadSettings(gm);
          // Another tab may have withdrawn consent since this page loaded
          if (!current.consent) return;
          const { accepted } = ctx.queue.enqueue(observations);
          if (accepted === 0) return;
          if (current.serverUrl && current.apiKey) {
            const api = createApi(gm, current, CLIENT_VERSION);
            void ctx.queue.flush(api, current.deviceId, () => loadSettings(gm).consent);
          }
          onCollected();
        },
      });
    }
  }

  if (settings.serverUrl && settings.apiKey) {
    //! AGENTS.md §4: our server only, on page load, no game request
    const api = createApi(gm, settings, CLIENT_VERSION);
    void ctx.queue.flush(api, settings.deviceId, () => loadSettings(gm).consent);
  }
}
