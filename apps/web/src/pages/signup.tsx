import { signupRequestSchema, userResponseSchema } from '@app/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch } from '../api';
import { describeError, useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { AuthCard, AuthForm } from '../ui/auth-card';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { ErrorPage, NotFoundPage } from './error';

export const MIN_PASSWORD_LENGTH = 12;

type FieldErrors = { username?: string; password?: string };

function SignupForm({ endpoint, onInvalid }: { endpoint: string; onInvalid?: () => void }) {
  const t = useT();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: signupRequestSchema.parse({ username, password }),
        schema: userResponseSchema,
      });
      await refresh();
      navigate('/account', { replace: true });
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'invitation_invalid') return onInvalid?.();
      if (code === 'username_invalid' || code === 'username_taken') {
        return setFieldErrors({ username: t(`fieldErrors.${code}`) });
      }
      if (code === 'password_short') {
        return setFieldErrors({
          password: t('fieldErrors.password_short', { min: MIN_PASSWORD_LENGTH }),
        });
      }
      setError(describeError(t, err));
    }
  };

  return (
    <AuthCard title={t('signup.title')}>
      {error && <Alert>{error}</Alert>}
      <AuthForm onSubmit={submit}>
        <Field
          label={t('login.username')}
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          value={username}
          error={fieldErrors.username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label={t('login.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          hint={t('signup.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" block className="mt-2" disabled={busy}>
          {t('signup.submit')}
        </Button>
      </AuthForm>
      <p className="m-0 text-center text-[13px] leading-5 text-muted">
        {t('signup.haveAccount')} <Link to="/login">{t('signup.signIn')}</Link>
      </p>
    </AuthCard>
  );
}

export function OpenSignupPage() {
  const { openSignup } = useSession();
  return openSignup ? <SignupForm endpoint="/signup" /> : <NotFoundPage />;
}

export function InvitePage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    let live = true;
    apiFetch(`/invitations/${encodeURIComponent(token)}`)
      .then(() => live && setState('valid'))
      .catch(() => live && setState('invalid'));
    return () => {
      live = false;
    };
  }, [token]);

  if (state === 'checking') return null;
  if (state === 'invalid') return <ErrorPage messageKey="errorPage.invitationInvalid" />;
  return (
    <SignupForm
      endpoint={`/invitations/${encodeURIComponent(token)}`}
      onInvalid={() => setState('invalid')}
    />
  );
}
