import { createResetRequestSchema, linkResponseSchema, resetLinkResponseSchema } from '@app/shared';
import { useState } from 'react';
import { ApiError, apiFetch } from '../api';
import { describeError, useT } from '../i18n';
import { Alert } from '../ui/alert';
import { Page } from '../ui/app-shell';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Field } from '../ui/field';
import { SecretNotice } from '../ui/notice';

function InvitationsCard() {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/admin/invitations', {
        method: 'POST',
        schema: linkResponseSchema,
      });
      setUrl(res.url);
    } catch (err) {
      setError(describeError(t, err));
    }
    setBusy(false);
  };

  return (
    <Card title={t('admin.invitationsTitle')} subtitle={t('admin.invitationsSubtitle')}>
      {error && <Alert>{error}</Alert>}
      {url && <SecretNotice message={t('admin.invitationCreated')} secret={url} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={create} className="max-sm:w-full">
          {t('admin.createInvitation')}
        </Button>
      </div>
    </Card>
  );
}

function ResetCard() {
  const t = useT();
  const [username, setUsername] = useState('');
  const [link, setLink] = useState<{ url: string; username: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      setLink(
        await apiFetch('/admin/password-resets', {
          method: 'POST',
          body: createResetRequestSchema.parse({ username }),
          schema: resetLinkResponseSchema,
        }),
      );
      setUsername('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unknown_user') {
        setFieldError(t('admin.unknownUser'));
      } else {
        setError(describeError(t, err));
      }
    }
    setBusy(false);
  };

  return (
    <Card title={t('admin.resetTitle')} subtitle={t('admin.resetSubtitle')}>
      {error && <Alert>{error}</Alert>}
      {link && (
        <SecretNotice
          message={t('admin.resetCreated', { username: link.username })}
          secret={link.url}
        />
      )}
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
          label={t('admin.resetUsername')}
          name="username"
          autoComplete="off"
          required
          value={username}
          error={fieldError}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={busy} className="max-sm:w-full">
          {t('admin.createResetLink')}
        </Button>
      </form>
    </Card>
  );
}

export function AdminPage() {
  const t = useT();
  return (
    <Page title={t('admin.title')}>
      <InvitationsCard />
      <ResetCard />
    </Page>
  );
}
