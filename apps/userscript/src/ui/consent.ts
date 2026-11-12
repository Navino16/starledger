import { loadSettings, saveSettings } from '../storage';
import { setDestination } from '../sync/destination';
import { el, isHttpUrl, isInsecureUrl, type UiContext } from './dom';
import { openPanel } from './panel';

export const SETTINGS_ID = 'starledger-settings';

export function renderConsent(ctx: UiContext, onAccepted: () => void): void {
  const { doc, t, gm, queue } = ctx;
  const url = el(doc, 'input', {
    type: 'text',
    id: 'starledger-url',
    value: loadSettings(gm).serverUrl ?? '',
  });
  const destination = el(doc, 'strong', { id: 'starledger-destination' });
  const warning = el(doc, 'div', { className: 'starledger-warning' });
  const error = el(doc, 'div', { className: 'starledger-status' });
  const accept = el(doc, 'button', { type: 'button', textContent: t('consentAccept') });
  const cancel = el(doc, 'button', { type: 'button', textContent: t('consentCancel') });

  const refresh = () => {
    destination.textContent = url.value.trim() || t('consentNoServer');
    warning.textContent = isInsecureUrl(url.value) ? t('httpWarning') : '';
  };
  url.addEventListener('input', refresh);
  refresh();

  accept.addEventListener('click', () => {
    const value = url.value.trim();
    if (!isHttpUrl(value)) {
      error.textContent = t('invalidUrl');
      return;
    }
    setDestination(gm, queue, value, null);
    saveSettings(gm, { consent: true });
    onAccepted();
  });

  const handle = openPanel(
    doc,
    {
      id: SETTINGS_ID,
      title: t('consentTitle'),
      closeLabel: t('close'),
      closeOnOutside: false,
      onClose: () => ctx.refreshBox?.(),
    },
    [
      el(doc, 'p', { textContent: t('consentIntro') }),
      el(
        doc,
        'ul',
        {},
        el(doc, 'li', { textContent: t('consentReports') }),
        el(doc, 'li', { textContent: t('consentFleets') }),
        el(doc, 'li', { textContent: t('consentViews') }),
        el(doc, 'li', { textContent: t('consentAccount') }),
        el(doc, 'li', { textContent: t('consentDevice') }),
      ),
      el(doc, 'label', { textContent: t('serverUrl') }, url),
      el(doc, 'p', { textContent: `${t('consentDestination')} ` }, destination),
      warning,
      error,
      el(doc, 'div', { className: 'starledger-actions' }, accept, cancel),
    ],
  );
  cancel.addEventListener('click', handle.close);
}
