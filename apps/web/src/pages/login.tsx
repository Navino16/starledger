import { loginRequestSchema, userResponseSchema } from '@app/shared';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../api';
import { describeError, useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { AuthCard, AuthForm } from '../ui/auth-card';
import { Button } from '../ui/button';
import { Field } from '../ui/field';

export function LoginPage() {
  const t = useT();
  const { user, refresh } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/login', {
        method: 'POST',
        body: loginRequestSchema.parse({ username, password }),
        schema: userResponseSchema,
      });
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_credentials'
          ? t('login.invalid')
          : describeError(t, err),
      );
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t('login.title')}>
      {error && <Alert>{error}</Alert>}
      <AuthForm onSubmit={submit}>
        <Field
          label={t('login.username')}
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label={t('login.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" block className="mt-2" disabled={busy}>
          {t('login.submit')}
        </Button>
      </AuthForm>
    </AuthCard>
  );
}
