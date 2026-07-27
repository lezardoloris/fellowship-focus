"use client";

import { useEffect, useState } from "react";
import { desktopBridge } from "@/lib/desktop";
import { buildSoloWeeklyStats } from "@/lib/soloStats";

/**
 * [FOC-1] The three lines above Start.
 *
 * The Focus tab opened on a configuration form: a timer to set up and a list of
 * 25 domains nobody edits more than once a month. Measured ink density 0.39 and
 * 0.45, the two emptiest panels in the app, in its most valuable position.
 *
 * A freelancer opening this app is not asking "what is my score". They are
 * asking "what am I on now, and am I behind on what I have to invoice". So the
 * strip is denominated in euros and hours, never in points, and it is three
 * lines rather than a dashboard: anything longer and this becomes a report you
 * check and close, which is the failure mode of every time tracker.
 *
 * Each line disappears when its data does not exist yet. No onboarding form on
 * first launch: the lines appear as the numbers become real.
 */

type Money = {
  tracked_minutes: number;
  billable_minutes: number;
  effective_rate_cents: number;
  currency: string;
};

type Temptations = { top: Array<{ site: string; c: number }> };

function money(cents: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  return `${symbol}${Math.round(cents / 100).toLocaleString()}`;
}

export function TodayStrip({ token }: { token: string | null }) {
  const [moneyData, setMoneyData] = useState<Money | null>(null);
  const [temptations, setTemptations] = useState<Temptations | null>(null);
  const [todayMin, setTodayMin] = useState<number | null>(null);
  const [targetMin, setTargetMin] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/money?token=${encodeURIComponent(token)}&window=week`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && j && setMoneyData(j as Money))
      .catch(() => {});
    fetch(`/api/temptations?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && j && setTemptations(j as Temptations))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const stats = desktopBridge.present()
        ? (await desktopBridge.getWeeklyStats()) || buildSoloWeeklyStats()
        : buildSoloWeeklyStats();
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const day = stats.days.find((d) => d.date === today);
      setTodayMin(day ? day.focus_minutes : 0);
      // A weekly target spread over five working days. Dividing by seven would
      // quietly tell someone they are on track while owing themselves Saturday.
      const weekly = stats.okr?.focus_hours?.target || 0;
      setTargetMin(weekly > 0 ? Math.round((weekly * 60) / 5) : null);
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const unbilledMin = moneyData
    ? Math.max(0, moneyData.tracked_minutes - moneyData.billable_minutes)
    : 0;
  const unbilledCents = moneyData
    ? Math.round((unbilledMin / 60) * moneyData.effective_rate_cents)
    : 0;
  const showUnbilled = Boolean(
    moneyData && unbilledMin >= 30 && moneyData.effective_rate_cents > 0
  );
  const topSite = temptations?.top?.[0];
  const showToday = todayMin !== null && targetMin !== null && targetMin > 0;

  if (!showUnbilled && !showToday && !topSite) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      {showUnbilled && moneyData && (
        <span className="pp-body">
          <span className="hud-num font-semibold pp-strong">
            {(unbilledMin / 60).toFixed(1)} h
          </span>{" "}
          worked and not invoiced this week
          <span className="pp-muted">
            {" "}
            · {money(unbilledCents, moneyData.currency)}
          </span>
        </span>
      )}
      {showToday && (
        <span className="pp-body">
          <span className="hud-num font-semibold pp-strong">
            {((todayMin || 0) / 60).toFixed(1)} h
          </span>{" "}
          today
          <span className="pp-muted"> · target {((targetMin || 0) / 60).toFixed(1)} h</span>
        </span>
      )}
      {topSite && (
        <span className="pp-muted">
          Costliest distraction: <span className="pp-body">{topSite.site}</span> ({topSite.c}×)
        </span>
      )}
    </div>
  );
}
