import type { StatsResponse } from '@app/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber, useT } from '../i18n';
import { useSession } from '../session';
import { ChartCard } from './chart-card';

const AXIS = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--color-muted)' };
const LABEL = { fontSize: 13, fill: 'var(--color-body)' };
const ROW_HEIGHT = 40;

interface Row {
  label: string;
  found: number;
  lost: number;
}

/** Counted in ships, never valued: units are not mixed (spec §8). */
export function ShipsChart({ ships }: { ships: StatsResponse['summary']['ships'] }) {
  const t = useT();
  const { locale } = useSession();
  const ids = [...new Set([...Object.keys(ships.found), ...Object.keys(ships.lost)])]
    .filter((id) => (ships.found[id] ?? 0) > 0 || (ships.lost[id] ?? 0) > 0)
    .sort((a, b) => Number(a) - Number(b));
  const rows: Row[] = ids.map((id) => ({
    label: t(`shipNames.${id}`),
    found: ships.found[id] ?? 0,
    lost: ships.lost[id] ?? 0,
  }));
  const label = t('dashboard.ships.summary', {
    rows: rows
      .map(
        (r) =>
          `${r.label} ${t('dashboard.ships.found')} ${formatNumber(r.found, locale)}, ${t('dashboard.ships.lost')} ${formatNumber(r.lost, locale)}`,
      )
      .join(' ; '),
  });
  const height = rows.length * ROW_HEIGHT + 32;

  return (
    <ChartCard title={t('dashboard.ships.title')} empty={rows.length === 0}>
      <p className="m-0 flex gap-4 text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-chip bg-gain" />
          {t('dashboard.ships.found')}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-chip bg-danger" />
          {t('dashboard.ships.lost')}
        </span>
      </p>
      <div role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
          <BarChart data={rows} layout="vertical" barGap={2} margin={{ right: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              allowDecimals={false}
              tickFormatter={(v: number) => formatNumber(v, locale)}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={LABEL}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-raised)' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                return (
                  <div className="rounded-control border border-line bg-raised px-3 py-2 text-[13px] text-body tabular-nums">
                    <div className="text-ink">{row.label}</div>
                    <div>
                      {t('dashboard.ships.found')} : {formatNumber(row.found, locale)}
                    </div>
                    <div>
                      {t('dashboard.ships.lost')} : {formatNumber(row.lost, locale)}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="found" fill="var(--color-gain)" isAnimationActive={false} />
            <Bar dataKey="lost" fill="var(--color-danger)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
