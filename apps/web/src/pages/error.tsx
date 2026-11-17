import { Link } from 'react-router';
import { useT } from '../i18n';
import { AuthCard } from '../ui/auth-card';

export function ErrorPage({
  titleKey = 'errorPage.title',
  messageKey,
}: {
  titleKey?: string;
  messageKey: string;
}) {
  const t = useT();
  return (
    <AuthCard title={t(titleKey)}>
      <p className="m-0 text-body">{t(messageKey)}</p>
      <p className="m-0">
        <Link to="/login">{t('errorPage.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}

export const NotFoundPage = () => (
  <ErrorPage titleKey="errorPage.notFoundTitle" messageKey="errorPage.notFound" />
);
