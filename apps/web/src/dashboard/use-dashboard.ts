import { accountsResponseSchema, type SiteAccount, type StatsResponse } from '@app/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../api';
import { describeError, useT } from '../i18n';
import {
  type AccountRef,
  accountKey,
  type DashboardPeriod,
  localToday,
  parseAccountKey,
  shiftDay,
} from './format';

const PERIODS: DashboardPeriod[] = ['day', 'week', 'month', 'all'];
const STORAGE_KEY = 'starledger.dashboardAccount';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRealDay = (value: string | null): value is string =>
  !!value && DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// Storage can throw (private mode, blocked site data): the dashboard works without it.
function readStoredAccount(): AccountRef | null {
  try {
    return parseAccountKey(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
function storeAccount(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Remembering the account is a convenience only.
  }
}

const sameAccount = (a: AccountRef | null) => (b: SiteAccount) =>
  !!a && a.serverId === b.serverId && a.lang === b.lang && a.playerId === b.playerId;

export function useDashboard() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState<SiteAccount[] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch('/accounts', { schema: accountsResponseSchema })
      .then((res) => live && setAccounts(res.accounts))
      .catch((err) => live && setError(describeError(t, err)));
    return () => {
      live = false;
    };
  }, [t]);

  const account = useMemo(() => {
    if (!accounts) return null;
    return (
      accounts.find(sameAccount(parseAccountKey(params.get('account')))) ??
      accounts.find(sameAccount(readStoredAccount())) ??
      accounts[0] ??
      null
    );
  }, [accounts, params]);
  const key = account ? accountKey(account) : null;
  const rawPeriod = params.get('period');
  const period = PERIODS.includes(rawPeriod as DashboardPeriod)
    ? (rawPeriod as DashboardPeriod)
    : 'month';
  const rawDay = params.get('day');
  const day = isRealDay(rawDay) ? rawDay : localToday();

  const update = useCallback(
    (changes: Record<string, string>, replace = false) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes)) next.set(name, value);
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (!key) return;
    storeAccount(key);
    if (params.get('account') !== key) update({ account: key }, true);
  }, [key, params, update]);

  useEffect(() => {
    if (!account) return;
    let live = true;
    const query = new URLSearchParams({
      serverId: String(account.serverId),
      lang: account.lang,
      playerId: String(account.playerId),
      period,
      today: day,
    });
    setError(null);
    // A late answer for a previous selection must not overwrite the current one.
    apiFetch<StatsResponse>(`/stats?${query}`)
      .then((res) => live && setStats(res))
      .catch((err) => live && setError(describeError(t, err)));
    return () => {
      live = false;
    };
  }, [account, period, day, t]);

  return {
    accounts,
    account,
    period,
    day,
    stats,
    error,
    selectAccount: (next: string) => update({ account: next }),
    selectPeriod: (next: DashboardPeriod) => update({ period: next }),
    selectDay: (next: string) => update({ period: 'day', day: next }),
    shift: (delta: 1 | -1) => update({ day: shiftDay(day, period, delta) }),
  };
}
