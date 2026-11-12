import { errorKey } from '../i18n';
import { loadSettings, saveSettings } from '../storage';
import { createApi } from '../sync/api';
import { setDestination } from '../sync/destination';
import { CLIENT_VERSION } from '../version';
import { renderConsent, SETTINGS_ID } from './consent';
import { el, isHttpUrl, isInsecureUrl, type UiContext } from './dom';
import { setOglightHidden } from './oglight';
import { openPanel } from './panel';

export function renderOptions(ctx: UiContext): void {
  const { doc, t, gm, queue } = ctx;
  const settings = loadSettings(gm);
  setOglightHidden(gm, doc, settings.hideOglightBox);
  const url = el(doc, 'input', {
    type: 'text',
    id: 'starledger-url',
    value: settings.serverUrl ?? '',
  });
  const key = el(doc, 'input', {
    type: 'password',
    id: 'starledger-key',
    placeholder: settings.apiKey ? t('keySet') : '',
    autocomplete: 'new-password',
  });
  const hide = el(doc, 'input', {
    type: 'checkbox',
    id: 'starledger-hide',
    checked: settings.hideOglightBox,
  });
  const status = el(doc, 'div', { className: 'starledger-status' });
  const warning = el(doc, 'div', { className: 'starledger-warning' });
  const save = el(doc, 'button', { type: 'button', textContent: t('save') });
  const test = el(doc, 'button', { type: 'button', textContent: t('testConnection') });
  const withdraw = el(doc, 'button', { type: 'button', textContent: t('withdraw') });
  const removeKey = el(doc, 'button', { type: 'button', textContent: t('removeKey') });

  const refreshWarning = () => {
    warning.textContent = isInsecureUrl(url.value) ? t('httpWarning') : '';
  };
  url.addEventListener('input', refreshWarning);
  refreshWarning();

  // A changed URL never reuses the stored key: it would leak to another server.
  const typed = () => {
    const value = url.value.trim();
    if (!isHttpUrl(value)) {
      status.textContent = t('invalidUrl');
      return null;
    }
    const current = loadSettings(gm);
    const urlChanged = value !== current.serverUrl;
    const typedKey = key.value.trim();
    if (urlChanged && !typedKey) {
      status.textContent = t('keyRequired');
      return null;
    }
    return { serverUrl: value, apiKey: typedKey || current.apiKey, urlChanged };
  };

  save.addEventListener('click', () => {
    const values = typed();
    if (!values) return;
    const { urlChanged, ...patch } = values;
    if (urlChanged) {
      //! AGENTS.md §1.9: consent was given for another destination, ask again
      setDestination(gm, queue, patch.serverUrl, key.value.trim() || null);
      saveSettings(gm, { consent: false });
      setOglightHidden(gm, doc, false);
      renderConsent(ctx, () => renderOptions(ctx));
      return;
    }
    saveSettings(gm, patch);
    key.value = '';
    key.placeholder = patch.apiKey ? t('keySet') : '';
    status.textContent = t('saved');
    ctx.refreshBox?.();
  });

  test.addEventListener('click', async () => {
    const values = typed();
    if (!values) return;
    status.textContent = t('testing');
    const api = createApi(
      gm,
      { ...loadSettings(gm), serverUrl: values.serverUrl, apiKey: values.apiKey },
      CLIENT_VERSION,
    );
    const result = await api.ping();
    status.textContent = result.ok
      ? t('connected', { name: result.data.username })
      : t(errorKey(result.error));
  });

  removeKey.addEventListener('click', () => {
    saveSettings(gm, { apiKey: null });
    key.value = '';
    key.placeholder = '';
    status.textContent = t('keyRemoved');
    ctx.refreshBox?.();
  });

  hide.addEventListener('change', () => {
    saveSettings(gm, { hideOglightBox: hide.checked });
    setOglightHidden(gm, doc, hide.checked);
  });

  withdraw.addEventListener('click', () => {
    saveSettings(gm, { consent: false });
    queue.clear();
    setOglightHidden(gm, doc, false);
    handle.close();
  });

  const handle = openPanel(
    doc,
    {
      id: SETTINGS_ID,
      title: t('menuLabel'),
      closeLabel: t('close'),
      closeOnOutside: false,
      onClose: () => ctx.refreshBox?.(),
    },
    [
      el(doc, 'label', { textContent: t('serverUrl') }, url),
      el(doc, 'label', { textContent: t('apiKey') }, key),
      el(doc, 'label', {}, hide, ` ${t('hideOglight')}`),
      warning,
      status,
      el(doc, 'div', { className: 'starledger-actions' }, save, test, removeKey, withdraw),
    ],
  );
}
