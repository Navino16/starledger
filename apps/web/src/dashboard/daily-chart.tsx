import type { StatsResponse } from '@app/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatDate, useT } from '../i18n';
import { useSession } from '../session';
import { ChartCard } from './chart-card';
import { monthTitle } from './format';

const AXIS = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--color-muted)' };

export function DailyChart({
  days,
  range,
  refDay,
  onSelectDay,
}: {
  days: StatsResponse['days'];
  range: StatsResponse['range'];
  refDay: string;
  onSelectDay: (day: string) => void;
}) {
  const t = useT();
  const { locale } = useSession();
  const total = days.reduce((sum, d) => sum + d.msu, 0);
  const active = days.filter((d) => d.msu !== 0).length;
  const inRange = (day: string) => !range || (day >= range.from && day <= range.to);
  const label = t('dashboard.daily.summary', {
    month: monthTitle(locale, refDay),
    total: formatCompact(total, locale),
    active,
  });
  return (
    <ChartCard
      title={t('dashboard.daily.title')}
      figure={`${Math.round(total) > 0 ? '+' : ''}${formatCompact(total, locale)}`}
      figureNote={t('dashboard.daily.unit')}
      empty={active === 0}
      className="col-span-2 max-lg:col-span-1"
    >
      <div role="img" aria-label={label}>
        <ResponsiveContainer
          width="100%"
          height={220}
          initialDimension={{ width: 640, height: 220 }}
        >
          <BarChart data={days} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(day: string) => String(Number(day.slice(8)))}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatCompact(v, locale)}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--color-control)" />
            <Tooltip
              cursor={{ fill: 'var(--color-raised)' }}
              content={({ active: shown, payload }) => {
                const point = shown ? payload?.[0]?.payload : null;
                if (!point) return null;
                return (
                  <div className="rounded-control border border-line bg-raised px-3 py-2 text-[13px] text-body">
                    <div className="text-ink">
                      {formatDate(`${point.day}T00:00:00Z`, locale, { timeZone: 'UTC' })}
                    </div>
                    <div className="tabular-nums">
                      {formatCompact(point.msu, locale)} {t('dashboard.daily.unit')}
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="msu"
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry) => {
                const day = (entry as { payload?: { day?: string } }).payload?.day;
                if (day) onSelectDay(day);
              }}
            >
              {days.map((d) => (
                <Cell
                  key={d.day}
                  data-day={d.day}
                  fill={d.msu < 0 ? 'var(--color-danger)' : 'var(--color-gain)'}
                  fillOpacity={inRange(d.day) ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
