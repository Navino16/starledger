import type { StatsResponse } from '@app/shared';
import type { ReactNode } from 'react';
import { formatCompact, useT } from '../i18n';
import { useSession } from '../session';
import { AlertIcon } from '../ui/icons';

type Summary = StatsResponse['summary'];

function Figure({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card bg-card p-4">
      <span className="text-[13px] leading-5 text-muted">{label}</span>
      <span className="text-[28px] leading-9 font-medium text-ink tabular-nums max-sm:text-2xl max-sm:leading-8">
        {value}
      </span>
      {note && <span className="text-xs leading-4 text-muted">{note}</span>}
    </div>
  );
}

export function KeyFigures({ summary }: { summary: Summary }) {
  const t = useT();
  const { locale } = useSession();
  const { tiles, fuel } = summary;
  const compact = (n: number) => formatCompact(n, locale);
  const signed = (n: number) => (Math.round(n) > 0 ? `+${compact(n)}` : compact(n));
  return (
    <section
      aria-label={t('dashboard.title')}
      className="grid grid-cols-7 gap-4 max-lg:grid-cols-4 max-sm:grid-cols-2 max-sm:gap-3"
    >
      <Figure label={t('dashboard.figures.metal')} value={compact(tiles.metal)} />
      <Figure label={t('dashboard.figures.crystal')} value={compact(tiles.crystal)} />
      <Figure label={t('dashboard.figures.deuterium')} value={compact(tiles.deuterium)} />
      <Figure label={t('dashboard.figures.darkMatter')} value={compact(tiles.darkMatter)} />
      <Figure label={t('dashboard.figures.artefacts')} value={compact(tiles.artefacts)} />
      <Figure label={t('dashboard.figures.msu')} value={signed(tiles.msu)} />
      <Figure
        label={t('dashboard.figures.fuel')}
        value={compact(fuel.recorded)}
        note={
          fuel.unknownCount > 0
            ? t('dashboard.figures.fuelUnknown', { n: fuel.unknownCount })
            : undefined
        }
      />
    </section>
  );
}

/** Unknown is not zero (spec §12): say what the figures leave out. */
export function PartialData({ stats }: { stats: StatsResponse }) {
  const t = useT();
  const items = [
    stats.counts.unrecognized > 0 &&
      t('dashboard.partial.unrecognized', { n: stats.counts.unrecognized }),
    stats.summary.conflictCount > 0 &&
      t('dashboard.partial.conflicts', { n: stats.summary.conflictCount }),
    stats.summary.fuel.unknownCount > 0 &&
      t('dashboard.partial.fuelUnknown', { n: stats.summary.fuel.unknownCount }),
  ].filter((item): item is string => typeof item === 'string');
  if (items.length === 0) return null;
  return (
    <p className="m-0 flex items-start gap-3 rounded-lg border border-line px-4 py-3 text-[13px] leading-5 text-body">
      <AlertIcon className="mt-0.5 flex-none text-muted" />
      <span>
        <span className="text-ink">{t('dashboard.partial.title')}</span> · {items.join(' · ')}
      </span>
    </p>
  );
}
