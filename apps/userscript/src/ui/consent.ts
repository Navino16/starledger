import { loadSettings, saveSettings } from '../storage';
import { setDestination } from '../sync/destination';
import { configureBoxContent, el, isHttpUrl, isInsecureUrl, mountBox, type UiContext } from './dom';

export function renderConfigureBox(ctx: UiContext, onConfigure: () => void): void {
  const { doc, t } = ctx;
  mountBox(doc, configureBoxContent(doc, t, onConfigure));
}

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
  cancel.addEventListener('click', () =>
    renderConfigureBox(ctx, () => renderConsent(ctx, onAccepted)),
  );

  mountBox(
    doc,
    el(
      doc,
      'div',
      {},
      el(doc, 'strong', { textContent: t('consentTitle') }),
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
      accept,
      ' ',
      cancel,
    ),
  );
}
