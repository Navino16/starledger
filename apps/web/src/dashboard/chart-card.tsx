import type { ReactNode } from 'react';
import { useT } from '../i18n';

/** A dashboard block: title, optional headline figure, then the chart or the no-data note. */
export function ChartCard({
  title,
  figure,
  figureNote,
  empty,
  className = '',
  children,
}: {
  title: string;
  figure?: string;
  figureNote?: string;
  empty: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section
      className={`flex min-w-0 flex-col gap-5 rounded-card bg-card p-6 max-sm:gap-4 max-sm:p-4 ${className}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg leading-6 font-medium text-ink">{title}</h2>
        {figure && !empty && (
          <p className="m-0 text-[28px] leading-9 font-medium text-ink tabular-nums">
            {figure}
            {figureNote && (
              <small className="ml-1 text-sm font-normal text-muted">{figureNote}</small>
            )}
          </p>
        )}
      </div>
      {empty ? (
        <p className="m-0 rounded-lg border border-dashed border-line p-4 text-center text-muted">
          {t('dashboard.noData')}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
