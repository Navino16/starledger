import type { StatsResponse } from '@app/shared';
import { formatNumber, useT } from '../i18n';
import { useSession } from '../session';
import { ChartCard } from './chart-card';

type Outcomes = StatsResponse['summary']['expeditions']['outcomes'];

/** A share list with neutral bars, not a pie (docs/web-design.md, Graphiques). */
export function OutcomesList({ outcomes }: { outcomes: Outcomes }) {
  const t = useT();
  const { locale } = useSession();
  const rows = Object.entries(outcomes)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  const percent = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (
    <ChartCard
      title={t('dashboard.outcomes.title')}
      figure={formatNumber(total, locale)}
      figureNote={t('dashboard.outcomes.unit')}
      empty={total === 0}
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] tabular-nums">
        {rows.map(([key, n]) => (
          <li
            key={key}
            className="grid min-h-7 grid-cols-[8px_minmax(0,7.5rem)_minmax(0,1fr)_2.5rem_3.5rem] items-center gap-2"
          >
            <span
              className="size-2 rounded-chip"
              style={{ background: `var(--color-outcome-${key}, var(--color-muted))` }}
            />
            <span className="truncate text-body">{t(`dashboard.outcomes.${key}`)}</span>
            <span className="block h-1.5 overflow-hidden rounded-[3px] bg-raised">
              <span
                className="block h-full rounded-[3px] bg-muted"
                style={{ width: `${(n / total) * 100}%` }}
              />
            </span>
            <span className="text-right text-ink">{formatNumber(n, locale)}</span>
            <span className="text-right text-muted">{percent.format(n / total)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
