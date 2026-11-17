import {
  type ApiKeySummaryDto,
  apiKeysResponseSchema,
  changePasswordRequestSchema,
  createKeyRequestSchema,
  createKeyResponseSchema,
  MAX_KEY_NAME_LENGTH,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../api';
import { describeError, formatDate, useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { Page } from '../ui/app-shell';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Field } from '../ui/field';
import { Notice, SecretNotice } from '../ui/notice';
import { MIN_PASSWORD_LENGTH } from './signup';

const loadKeys = () => apiFetch('/api-keys', { schema: apiKeysResponseSchema });

function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKeySummaryDto; onRevoke: () => void }) {
  const t = useT();
  const { locale } = useSession();
  return (
    <tr>
      <td>
        {apiKey.name ? (
          <span className="font-medium text-ink">{apiKey.name}</span>
        ) : (
          <span className="text-muted">{t('account.unnamed')}</span>
        )}
      </td>
      <td>
        <span className="font-mono text-[13px]">{apiKey.prefix}…</span>
      </td>
      <td data-label={t('account.createdAt')}>{formatDate(apiKey.createdAt, locale)}</td>
      <td data-label={t('account.lastUsedLabel')}>
        {apiKey.lastUsedAt ? (
          formatDate(apiKey.lastUsedAt, locale, { time: true })
        ) : (
          <span className="text-muted">{t('account.never')}</span>
        )}
      </td>
      <td>
        <Button variant="danger" size="sm" onClick={onRevoke}>
          {t('account.revoke')}
        </Button>
      </td>
    </tr>
  );
}

function ApiKeysCard() {
  const t = useT();
  const [keys, setKeys] = useState<ApiKeySummaryDto[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadKeys()
      .then((res) => live && setKeys(res.keys))
      .catch((err) => live && setError(describeError(t, err)));
    return () => {
      live = false;
    };
  }, [t]);

  const create = async () => {
    setBusy(true);
    setError(null);
    setNameError(null);
    try {
      const { key } = await apiFetch('/api-keys', {
        method: 'POST',
        body: createKeyRequestSchema.parse({ name }),
        schema: createKeyResponseSchema,
      });
      setCreated(key);
      setName('');
      setKeys((await loadKeys()).keys);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_invalid') {
        setNameError(t('account.nameInvalid', { max: MAX_KEY_NAME_LENGTH }));
      } else {
        setError(describeError(t, err));
      }
    }
    setBusy(false);
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setKeys((current) => current?.filter((key) => key.id !== id) ?? null);
    } catch (err) {
      setError(describeError(t, err));
    }
  };

  return (
    <Card title={t('account.keysTitle')} subtitle={t('account.keysSubtitle')}>
      {error && <Alert>{error}</Alert>}
      {created && <SecretNotice message={t('account.keyCreated')} secret={created} />}
      <form
        className="flex flex-wrap items-end gap-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <Field
          className="flex-[0_1_320px] max-sm:flex-[1_1_100%]"
          label={t('account.keyName')}
          name="name"
          required
          maxLength={MAX_KEY_NAME_LENGTH}
          placeholder={t('account.keyNamePlaceholder')}
          value={name}
          error={nameError}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={busy} className="max-sm:w-full">
          {t('account.createKey')}
        </Button>
      </form>
      {keys &&
        (keys.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-line p-4 text-center text-muted">
            {t('account.noKey')}
          </p>
        ) : (
          <table className="keys-table">
            <caption className="sr-only">{t('account.keysCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('account.keyName')}</th>
                <th scope="col">{t('account.keyColumn')}</th>
                <th scope="col">{t('account.createdAt')}</th>
                <th scope="col">{t('account.lastUsed')}</th>
                <th scope="col">
                  <span className="sr-only">{t('account.action')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <KeyRow key={key.id} apiKey={key} onRevoke={() => revoke(key.id)} />
              ))}
            </tbody>
          </table>
        ))}
    </Card>
  );
}

function PasswordCard() {
  const t = useT();
  const { user } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [nextError, setNextError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentWrong, setCurrentWrong] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNextError(null);
    setCurrentWrong(false);
    setDone(false);
    try {
      await apiFetch('/password', {
        method: 'POST',
        body: changePasswordRequestSchema.parse({ current, next }),
      });
      setCurrent('');
      setNext('');
      setDone(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'current_invalid') {
        setCurrentWrong(true);
        setError(t('account.currentInvalid'));
      } else if (code === 'password_short') {
        setNextError(t('fieldErrors.password_short', { min: MIN_PASSWORD_LENGTH }));
      } else setError(describeError(t, err));
    }
    setBusy(false);
  };

  return (
    <Card title={t('account.passwordTitle')} subtitle={t('account.passwordSubtitle')}>
      {error && <Alert>{error}</Alert>}
      {done && <Notice message={t('account.passwordChanged')} />}
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* For password managers: they pair the new password with this username. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.username ?? ''}
          readOnly
          hidden
        />
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 max-sm:grid-cols-1">
          <Field
            label={t('account.currentPassword')}
            name="current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            aria-invalid={currentWrong || undefined}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label={t('account.newPassword')}
            name="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            hint={t('signup.passwordHint', { min: MIN_PASSWORD_LENGTH })}
            error={nextError}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy} className="max-sm:w-full">
            {t('account.changePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AccountPage() {
  const t = useT();
  return (
    <Page title={t('account.title')}>
      <ApiKeysCard />
      <PasswordCard />
    </Page>
  );
}
