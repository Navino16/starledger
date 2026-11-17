import { DailyChart } from '../dashboard/daily-chart';
import { accountKey, type DashboardPeriod, periodTitle } from '../dashboard/format';
import { KeyFigures, PartialData } from '../dashboard/key-figures';
import { OutcomesList } from '../dashboard/outcomes';
import { useDashboard } from '../dashboard/use-dashboard';
import { useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { Page } from '../ui/app-shell';
import { Button } from '../ui/button';
import { INPUT_CLASSES } from '../ui/field';
import { ChevronIcon } from '../ui/icons';

const PERIODS: DashboardPeriod[] = ['day', 'week', 'month', 'all'];

const SEGMENT =
  'flex h-8 items-center justify-center rounded-control border border-transparent px-3 text-[13px] text-muted transition-colors hover:bg-raised hover:text-ink aria-pressed:border-gold aria-pressed:bg-hover aria-pressed:text-ink max-sm:h-9 max-sm:flex-1';

export function DashboardPage() {
  const t = useT();
  const { locale } = useSession();
  const dashboard = useDashboard();
  const { accounts, account, period, day, stats, error } = dashboard;

  const toolbar = accounts && accounts.length > 0 && account && (
    <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
      <label className="sr-only" htmlFor="dashboard-account">
        {t('dashboard.account')}
      </label>
      <select
        id="dashboard-account"
        className={`${INPUT_CLASSES} w-auto min-w-[200px] max-sm:w-full`}
        value={accountKey(account)}
        onChange={(e) => dashboard.selectAccount(e.target.value)}
      >
        {accounts.map((a) => (
          <option key={accountKey(a)} value={accountKey(a)}>
            {t('dashboard.accountLabel', {
              serverId: a.serverId,
              lang: a.lang,
              player: a.playerName ?? t('dashboard.unnamedPlayer', { id: a.playerId }),
            })}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 max-sm:w-full">
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.previous')}
          onClick={() => dashboard.shift(-1)}
        >
          <ChevronIcon className="rotate-90" />
        </Button>
        <fieldset className="m-0 flex gap-1 rounded-lg border-0 bg-card p-1 max-sm:flex-1">
          <legend className="sr-only">{t('dashboard.periodLabel')}</legend>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={SEGMENT}
              aria-pressed={p === period}
              onClick={() => dashboard.selectPeriod(p)}
            >
              {t(`dashboard.periods.${p}`)}
            </button>
          ))}
        </fieldset>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.next')}
          onClick={() => dashboard.shift(1)}
        >
          <ChevronIcon className="-rotate-90" />
        </Button>
      </div>
    </div>
  );

  return (
    <Page
      title={accounts?.length ? periodTitle(t, locale, period, day) : t('dashboard.title')}
      actions={toolbar}
      wide
    >
      {error && <Alert>{error}</Alert>}
      {accounts?.length === 0 && <p className="m-0 text-muted">{t('dashboard.noAccount')}</p>}
      {stats && account && (
        <>
          <PartialData stats={stats} />
          <KeyFigures summary={stats.summary} />
          <div className="grid grid-cols-3 items-start gap-6 max-lg:grid-cols-1 max-sm:gap-4">
            <DailyChart
              days={stats.days}
              range={stats.range}
              refDay={day}
              onSelectDay={dashboard.selectDay}
            />
            <OutcomesList outcomes={stats.summary.expeditions.outcomes} />
          </div>
        </>
      )}
    </Page>
  );
}
