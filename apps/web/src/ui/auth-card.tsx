import { type ReactNode, useEffect } from 'react';
import { useT } from '../i18n';

export function useDocumentTitle(title: string) {
  const t = useT();
  useEffect(() => {
    document.title = `${title} - ${t('appName')}`;
  }, [title, t]);
}

/** The centered 400 px card of the signed-out pages (docs/web-design.md, Mise en page). */
export function AuthCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  useDocumentTitle(title);
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 max-sm:items-start max-sm:px-4">
      <section className="flex w-full max-w-[400px] flex-col gap-6 rounded-card bg-card p-8 max-sm:px-5 max-sm:py-6">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-base leading-6 font-semibold text-ink">{t('appName')}</p>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[28px] leading-9 font-medium text-ink max-sm:text-2xl max-sm:leading-8">
              {title}
            </h1>
            {lead && <p className="m-0 text-muted">{lead}</p>}
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export function AuthForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
