import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { apiFetch } from '../api';
import { useT } from '../i18n';
import { useSession } from '../session';
import { useDocumentTitle } from './auth-card';
import { Button } from './button';

const NAV_LINK =
  '-mb-px flex min-h-11 items-center border-b-2 border-transparent px-3 text-muted no-underline transition-colors hover:text-ink aria-[current=page]:border-gold aria-[current=page]:text-ink max-sm:px-2 max-sm:whitespace-nowrap';

/** Header shared by the signed-in pages (docs/web-design.md, Mise en page); no Dashboard tab yet (spec web-front, non-objectifs). */
export function AppShell() {
  const t = useT();
  const { user, refresh } = useSession();
  const navigate = useNavigate();

  const logout = async () => {
    await apiFetch('/logout', { method: 'POST' }).catch(() => undefined);
    await refresh().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center gap-x-6 px-6 max-sm:px-4">
          <Link
            to="/account"
            className="text-base leading-6 font-semibold text-ink no-underline hover:text-ink"
          >
            {t('appName')}
          </Link>
          <nav
            aria-label={t('nav.label')}
            className="flex gap-1 self-stretch max-sm:order-3 max-sm:-mx-2.5 max-sm:w-[calc(100%+20px)] max-sm:gap-0.5 max-sm:overflow-x-auto"
          >
            <NavLink to="/account" className={NAV_LINK}>
              {t('nav.account')}
            </NavLink>
            <NavLink to="/settings" className={NAV_LINK}>
              {t('nav.settings')}
            </NavLink>
            {user?.isAdmin && (
              <NavLink to="/admin" className={NAV_LINK}>
                {t('nav.admin')}
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1 text-muted max-sm:-mr-3">
            <span>{user?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </>
  );
}

/** The 1200 px container with a 720 px column of cards, aligned left. */
export function Page({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 pt-8 pb-16 max-sm:gap-4 max-sm:px-4 max-sm:pt-5 max-sm:pb-12 [&>*]:w-full [&>*]:max-w-[720px]">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] leading-9 font-medium text-ink max-sm:text-2xl max-sm:leading-8">
          {title}
        </h1>
        {lead && <p className="m-0 text-muted">{lead}</p>}
      </div>
      {children}
    </main>
  );
}
