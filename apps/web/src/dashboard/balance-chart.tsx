import { type Resources, type StatsResponse, toMsu } from '@app/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, useT } from '../i18n';
import { useSession } from '../session';
import { ChartCard } from './chart-card';

const AXIS = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--color-muted)' };
const LABEL = { fontSize: 13, fill: 'var(--color-body)' };
const ROW_HEIGHT = 36;

interface Row {
  label: string;
  gain: number;
  loss: number;
  gains: Resources;
  losses: Resources;
}

const ZERO: Resources = { metal: 0, crystal: 0, deuterium: 0 };

export function BalanceChart({
  summary,
  settings,
}: {
  summary: StatsResponse['summary'];
  settings: StatsResponse['settings'];
}) {
  const t = useT();
  const { locale } = useSession();
  const entries: [string, { gains: Resources; losses: Resources }][] = Object.entries(
    summary.balance,
  );
  // Trades count in the MSU balance only when the universe says so, like the detail window's trades row.
  if (settings.includeTradesInBalance) {
    entries.push(['trades', { gains: summary.trades.received, losses: summary.trades.delivered }]);
  }
  const rows: Row[] = entries
    .map(([key, { gains, losses }]) => ({
      label: t(`dashboard.balance.${key}`),
      gain: toMsu(gains ?? ZERO, settings.msuRatio),
      loss: -toMsu(losses ?? ZERO, settings.msuRatio),
      gains,
      losses,
    }))
    .filter((row) => Math.round(row.gain) !== 0 || Math.round(row.loss) !== 0);
  const compact = (n: number) => formatCompact(n, locale);
  const label = t('dashboard.balance.summary', {
    rows: rows.map((r) => `${r.label} +${compact(r.gain)} ${compact(r.loss)}`).join(' ; '),
  });

  return (
    <ChartCard
      title={t('dashboard.balance.title')}
      empty={rows.length === 0}
      className="col-span-2 max-lg:col-span-1"
    >
      <div role="img" aria-label={label}>
        <ResponsiveContainer
          width="100%"
          height={rows.length * ROW_HEIGHT + 32}
          initialDimension={{ width: 640, height: rows.length * ROW_HEIGHT + 32 }}
        >
          <BarChart data={rows} layout="vertical" stackOffset="sign" margin={{ right: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={compact}
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
              width={150}
            />
            <ReferenceLine x={0} stroke="var(--color-control)" />
            <Tooltip
              cursor={{ fill: 'var(--color-raised)' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                const line = (name: string, r: Resources) =>
                  `${name} : ${compact(r.metal)} · ${compact(r.crystal)} · ${compact(r.deuterium)}`;
                return (
                  <div className="rounded-control border border-line bg-raised px-3 py-2 text-[13px] text-body tabular-nums">
                    <div className="text-ink">{row.label}</div>
                    <div>{line(t('dashboard.balance.gains'), row.gains)}</div>
                    <div>{line(t('dashboard.balance.losses'), row.losses)}</div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="gain"
              stackId="balance"
              fill="var(--color-gain)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="loss"
              stackId="balance"
              fill="var(--color-danger)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
