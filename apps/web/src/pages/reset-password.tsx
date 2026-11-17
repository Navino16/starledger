import { resetInfoResponseSchema, resetRequestSchema, userResponseSchema } from '@app/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch } from '../api';
import { describeError, useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { AuthCard, AuthForm } from '../ui/auth-card';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { ErrorPage } from './error';
import { MIN_PASSWORD_LENGTH } from './signup';

export function ResetPasswordPage() {
  const t = useT();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const path = `/password-resets/${encodeURIComponent(token)}`;
  const [account, setAccount] = useState<string | null | 'invalid'>(null);
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    apiFetch(path, { schema: resetInfoResponseSchema })
      .then((info) => live && setAccount(info.username))
      .catch(() => live && setAccount('invalid'));
    return () => {
      live = false;
    };
  }, [path]);

  if (account === null) return null;
  if (account === 'invalid') return <ErrorPage messageKey="errorPage.resetInvalid" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await apiFetch(path, {
        method: 'POST',
        body: resetRequestSchema.parse({ password }),
        schema: userResponseSchema,
      });
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'reset_invalid') return setAccount('invalid');
      if (code === 'password_short') {
        return setFieldError(t('fieldErrors.password_short', { min: MIN_PASSWORD_LENGTH }));
      }
      setError(describeError(t, err));
    }
  };

  return (
    <AuthCard title={t('reset.title')} lead={t('reset.account', { username: account })}>
      {error && <Alert>{error}</Alert>}
      <AuthForm onSubmit={submit}>
        {/* Lets password managers file the new password under the right account. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={account}
          hidden
          readOnly
        />
        <Field
          label={t('reset.newPassword')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          hint={t('signup.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          error={fieldError}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" block className="mt-2" disabled={busy}>
          {t('reset.submit')}
        </Button>
      </AuthForm>
    </AuthCard>
  );
}
