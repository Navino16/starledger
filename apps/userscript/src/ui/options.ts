import { errorKey } from '../i18n';
import { loadSettings, saveSettings } from '../storage';
import { createApi } from '../sync/api';
import { CLIENT_VERSION } from '../version';
import { renderConfigureBox, renderConsent } from './consent';
import { el, isHttpUrl, mountBox, PANEL_ID, type UiContext } from './dom';
import { setOglightHidden } from './oglight';

export function renderOptions(ctx: UiContext): void {
  const { doc, t, gm, queue } = ctx;
  const settings = loadSettings(gm);
  const url = el(doc, 'input', {
    type: 'text',
    id: 'starledger-url',
    value: settings.serverUrl ?? '',
  });
  // The stored key is never rendered back, only a placeholder
  const key = el(doc, 'input', {
    type: 'password',
    id: 'starledger-key',
    placeholder: settings.apiKey ? t('keySet') : '',
    autocomplete: 'off',
  });
  const hide = el(doc, 'input', {
    type: 'checkbox',
    id: 'starledger-hide',
    checked: settings.hideOglightBox,
  });
  const status = el(doc, 'div', { className: 'starledger-status' });
  const save = el(doc, 'button', { type: 'button', textContent: t('save') });
  const test = el(doc, 'button', { type: 'button', textContent: t('testConnection') });
  const withdraw = el(doc, 'button', { type: 'button', textContent: t('withdraw') });
  const close = el(doc, 'button', { type: 'button', textContent: t('close') });

  const typed = () => {
    const value = url.value.trim();
    if (!isHttpUrl(value)) {
      status.textContent = t('invalidUrl');
      return null;
    }
    return { serverUrl: value, apiKey: key.value || loadSettings(gm).apiKey };
  };

  save.addEventListener('click', () => {
    const values = typed();
    if (!values) return;
    saveSettings(gm, values);
    key.value = '';
    key.placeholder = values.apiKey ? t('keySet') : '';
    status.textContent = t('saved');
  });

  test.addEventListener('click', async () => {
    const values = typed();
    if (!values) return;
    status.textContent = t('testing');
    const api = createApi(gm, { ...loadSettings(gm), ...values }, CLIENT_VERSION);
    const result = await api.ping();
    status.textContent = result.ok
      ? t('connected', { name: result.data.username })
      : t(errorKey(result.error));
  });

  hide.addEventListener('change', () => {
    saveSettings(gm, { hideOglightBox: hide.checked });
    setOglightHidden(gm, hide.checked);
  });

  withdraw.addEventListener('click', () => {
    saveSettings(gm, { consent: false });
    queue.clear();
    setOglightHidden(gm, false);
    renderConfigureBox(ctx, () => renderConsent(ctx, () => renderOptions(ctx)));
  });

  close.addEventListener('click', () => doc.getElementById(PANEL_ID)?.remove());

  mountBox(
    doc,
    el(
      doc,
      'div',
      {},
      el(doc, 'label', { textContent: t('serverUrl') }, url),
      el(doc, 'label', { textContent: t('apiKey') }, key),
      el(doc, 'label', {}, hide, ` ${t('hideOglight')}`),
      status,
      save,
      ' ',
      test,
      ' ',
      withdraw,
      ' ',
      close,
    ),
  );
}
