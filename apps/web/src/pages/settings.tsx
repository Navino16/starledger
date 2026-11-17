import {
  MAX_MSU_RATIO,
  MIN_MSU_RATIO,
  type SiteLocale,
  savedSettingsResponseSchema,
  settingsResponseSchema,
  type UniverseSettings,
} from '@app/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../api';
import { describeError, formatNumber, type Translate, useT } from '../i18n';
import { useSession } from '../session';
import { Alert } from '../ui/alert';
import { Page } from '../ui/app-shell';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { ChevronIcon } from '../ui/icons';
import { Notice } from '../ui/notice';

type Settings = UniverseSettings['settings'];
type Flag = 'ignoreExpeShipsLoss' | 'ignoreConsumption' | 'includeTradesInBalance';

interface Draft {
  msu: [string, string, string];
  expedition: string;
  anomaly: string;
  flags: Record<Flag, boolean>;
}

const FLAGS: Flag[] = ['ignoreExpeShipsLoss', 'ignoreConsumption', 'includeTradesInBalance'];
const RESOURCES = [
  { key: 'metal', swatch: 'bg-metal' },
  { key: 'crystal', swatch: 'bg-crystal' },
  { key: 'deuterium', swatch: 'bg-deuterium' },
] as const;

const toDraft = (s: Settings): Draft => ({
  msu: s.msuRatio.map(String) as Draft['msu'],
  expedition: String(s.expeditionShipRatio),
  anomaly: String(s.anomalyShipRatio),
  flags: {
    ignoreExpeShipsLoss: s.ignoreExpeShipsLoss,
    ignoreConsumption: s.ignoreConsumption,
    includeTradesInBalance: s.includeTradesInBalance,
  },
});

// An empty field becomes NaN, serialized as null: the server rejects it as settings_invalid.
const toSettings = (d: Draft) => ({
  msuRatio: d.msu.map((v) => (v.trim() === '' ? Number.NaN : Number(v))),
  expeditionShipRatio: d.expedition.trim() === '' ? Number.NaN : Number(d.expedition),
  anomalyShipRatio: d.anomaly.trim() === '' ? Number.NaN : Number(d.anomaly),
  ...d.flags,
});

const isPercent = (v: number) => Number.isInteger(v) && v >= 0 && v <= 100;

// The server only says settings_invalid: the fields to flag are found with the same bounds.
const outOfRange = (d: Draft) => {
  const s = toSettings(d);
  return {
    msu: s.msuRatio.map((v) => !(v >= MIN_MSU_RATIO && v <= MAX_MSU_RATIO)),
    expedition: !isPercent(s.expeditionShipRatio),
    anomaly: !isPercent(s.anomalyShipRatio),
  };
};

export function summarize(t: Translate, locale: SiteLocale, s: Settings): string {
  return t('settings.summary', {
    msu: s.msuRatio.map((v) => formatNumber(v, locale)).join(t('settings.ratioSeparator')),
    expedition: formatNumber(s.expeditionShipRatio, locale),
    anomaly: formatNumber(s.anomalyShipRatio, locale),
  });
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-xs leading-4 text-muted">{legend}</legend>
      {children}
    </fieldset>
  );
}

function UniverseCard({
  universe,
  initiallyOpen,
}: {
  universe: UniverseSettings;
  initiallyOpen: boolean;
}) {
  const t = useT();
  const { locale } = useSession();
  const [saved, setSaved] = useState(universe.settings);
  const [draft, setDraft] = useState(() => toDraft(universe.settings));
  const [open, setOpen] = useState(initiallyOpen);
  const [error, setError] = useState<string | null>(null);
  const [bad, setBad] = useState<ReturnType<typeof outOfRange> | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = `u-${universe.serverId}-${universe.lang}`;

  const save = async () => {
    setBusy(true);
    setError(null);
    setBad(null);
    setDone(false);
    try {
      const res = await apiFetch(
        `/settings/${universe.serverId}/${encodeURIComponent(universe.lang)}`,
        { method: 'PUT', body: toSettings(draft), schema: savedSettingsResponseSchema },
      );
      setSaved(res.settings);
      setDraft(toDraft(res.settings));
      setDone(true);
    } catch (err) {
      const rejected = err instanceof ApiError && err.code === 'settings_invalid';
      setBad(rejected ? outOfRange(draft) : null);
      setError(rejected ? t('settings.invalid') : describeError(t, err));
    }
    setOpen(true);
    setBusy(false);
  };

  return (
    <details
      className="group rounded-card bg-card"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-card px-6 py-4 transition-colors group-open:rounded-b-none hover:bg-raised max-sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 max-sm:flex-col max-sm:items-start">
          <h2 className="m-0 text-lg leading-6 font-medium text-ink">
            {t('settings.universe', { serverId: universe.serverId, lang: universe.lang })}
          </h2>
          <span className="text-[13px] leading-5 text-muted tabular-nums group-open:hidden">
            {summarize(t, locale, saved)}
          </span>
        </span>
        <ChevronIcon className="flex-none text-muted transition-transform group-open:rotate-180" />
      </summary>
      <form
        className="flex flex-col gap-5 px-6 pt-2 pb-6 max-sm:gap-4 max-sm:px-4 max-sm:pt-0 max-sm:pb-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {error && <Alert>{error}</Alert>}
        {done && <Notice message={t('settings.saved')} />}
        <Fieldset legend={t('settings.msuLegend')}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 max-sm:grid-cols-1">
            {RESOURCES.map((resource, index) => (
              <Field
                key={resource.key}
                id={`${id}-${resource.key}`}
                label={
                  <>
                    <span
                      className={`mr-2 inline-block size-2 rounded-chip align-[1px] ${resource.swatch}`}
                    />
                    {t(`settings.${resource.key}`)}
                  </>
                }
                type="number"
                step="any"
                min={MIN_MSU_RATIO}
                max={MAX_MSU_RATIO}
                value={draft.msu[index]}
                aria-invalid={bad?.msu[index] || undefined}
                onChange={(e) => {
                  const msu = [...draft.msu] as Draft['msu'];
                  msu[index] = e.target.value;
                  setDraft({ ...draft, msu });
                }}
              />
            ))}
          </div>
        </Fieldset>
        <Fieldset legend={t('settings.shipsLegend')}>
          <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 max-sm:grid-cols-1">
            <Field
              id={`${id}-expedition`}
              label={t('settings.expeditionShipRatio')}
              type="number"
              step={1}
              min={0}
              max={100}
              value={draft.expedition}
              aria-invalid={bad?.expedition || undefined}
              onChange={(e) => setDraft({ ...draft, expedition: e.target.value })}
            />
            <Field
              id={`${id}-anomaly`}
              label={t('settings.anomalyShipRatio')}
              type="number"
              step={1}
              min={0}
              max={100}
              value={draft.anomaly}
              aria-invalid={bad?.anomaly || undefined}
              onChange={(e) => setDraft({ ...draft, anomaly: e.target.value })}
            />
          </div>
        </Fieldset>
        <div className="flex flex-col gap-3">
          {FLAGS.map((flag) => (
            <label key={flag} className="flex min-h-6 cursor-pointer items-start gap-3 text-body">
              <input
                type="checkbox"
                className="mt-px size-[18px] flex-none accent-gold"
                checked={draft.flags[flag]}
                onChange={(e) =>
                  setDraft({ ...draft, flags: { ...draft.flags, [flag]: e.target.checked } })
                }
              />
              <span>{t(`settings.${flag}`)}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy} className="max-sm:w-full">
            {t('settings.save')}
          </Button>
        </div>
      </form>
    </details>
  );
}

export function SettingsPage() {
  const t = useT();
  const [universes, setUniverses] = useState<UniverseSettings[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch('/settings', { schema: settingsResponseSchema })
      .then((res) => live && setUniverses(res.universes))
      .catch((err) => live && setError(describeError(t, err)));
    return () => {
      live = false;
    };
  }, [t]);

  return (
    <Page title={t('settings.title')} lead={t('settings.lead')}>
      {error && <Alert>{error}</Alert>}
      {universes?.length === 0 && <p className="m-0 text-muted">{t('settings.none')}</p>}
      {universes?.map((universe) => (
        <UniverseCard
          key={`${universe.serverId}-${universe.lang}`}
          universe={universe}
          initiallyOpen={universes.length === 1}
        />
      ))}
    </Page>
  );
}
