"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Nav from "../../components/nav";
import { getAlerts, getHealth, getWatchlist, type HealthResponse } from "../../lib/api";

type Row = Record<string, unknown>;

function groupRiskLevels(rows: Row[]) {
  const counts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  rows.forEach((r) => {
    const level = String(r.alert_level ?? r.risk_level ?? "LOW").toUpperCase();
    if (!counts[level]) counts[level] = 0;
    counts[level] += 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export default function DashboardPage() {
  const [watchlist, setWatchlist] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Row[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    Promise.all([getWatchlist(), getAlerts(), getHealth()])
      .then(([w, a, h]) => {
        setWatchlist(w.rows);
        setAlerts(a.rows);
        setHealth(h);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const riskDistribution = useMemo(() => groupRiskLevels(watchlist), [watchlist]);

  const overrunTrend = useMemo(
    () =>
      watchlist.slice(0, 25).map((r, i) => ({
        name: `P${i + 1}`,
        cost_overrun_pct: Number(r.cost_overrun_pct ?? 0) * 100,
      })),
    [watchlist]
  );

  const riskByTeamSize = useMemo(
    () =>
      watchlist.map((r) => ({
        x: Number(r.team_size ?? 0),
        y: Number(r.risk_probability ?? 0) * 100,
      })),
    [watchlist]
  );

  const heatmapCells = useMemo(
    () =>
      watchlist.slice(0, 30).map((r, idx) => ({
        key: idx,
        x: Number(r.schedule_delay ?? 0),
        y: Number(r.cost_overrun_pct ?? 0) * 100,
        probability: Number(r.risk_probability ?? 0),
      })),
    [watchlist]
  );

  return (
    <div>
      <Nav />
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4 animate-rise">
          <p className="text-xs uppercase tracking-wider text-ink/60">Watchlist Projects</p>
          <p className="mt-1 text-3xl font-semibold">{watchlist.length}</p>
        </div>
        <div className="panel p-4 animate-rise">
          <p className="text-xs uppercase tracking-wider text-ink/60">Early Alerts</p>
          <p className="mt-1 text-3xl font-semibold">{alerts.length}</p>
        </div>
        <div className="panel p-4 animate-rise">
          <p className="text-xs uppercase tracking-wider text-ink/60">Critical Signal</p>
          <p className="mt-1 text-3xl font-semibold">{riskDistribution.find((x) => x.name === "HIGH")?.value ?? 0}</p>
        </div>
        <div className="panel p-4 animate-rise">
          <p className="text-xs uppercase tracking-wider text-ink/60">Model Status</p>
          <p className={`mt-1 text-xl font-semibold ${health?.model_loaded ? "text-mint" : "text-red-600"}`}>
            {health === null ? "Checking…" : health.model_loaded ? "Online" : "Offline"}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 animate-rise">
          <h2 className="mb-3 text-lg font-semibold">Project Risk Distribution</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#d9481c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4 animate-rise">
          <h2 className="mb-3 text-lg font-semibold">Cost Overrun Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overrunTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="cost_overrun_pct" stroke="#3a8d8b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 animate-rise">
          <h2 className="mb-3 text-lg font-semibold">Risk by Team Size</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Team size" />
                <YAxis dataKey="y" name="Risk %" unit="%" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={riskByTeamSize} fill="#b8872d" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4 animate-rise">
          <h2 className="mb-3 text-lg font-semibold">Risk Heatmap (Delay vs Overrun)</h2>
          <div className="grid grid-cols-6 gap-2">
            {heatmapCells.map((c) => {
              const p = c.probability;
              const shade = p > 0.8 ? "#d9481c" : p > 0.6 ? "#e47b3b" : p > 0.4 ? "#e9b35a" : "#88b7b5";
              return (
                <div
                  key={c.key}
                  className="rounded-md p-2 text-xs text-white"
                  style={{ backgroundColor: shade }}
                  title={`Delay ${c.x} | Overrun ${c.y.toFixed(1)}% | Risk ${(p * 100).toFixed(1)}%`}
                >
                  {(p * 100).toFixed(0)}%
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 panel p-4 animate-rise">
        <h2 className="mb-3 text-lg font-semibold">Early Warning Alerts</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left">
                <th className="p-2">Project ID</th>
                <th className="p-2">Alerts</th>
                <th className="p-2">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 20).map((r, i) => (
                <tr key={i} className="border-b border-ink/10">
                  <td className="p-2">{String(r.project_id ?? i)}</td>
                  <td className="p-2">{String(r.alerts ?? r.alert_type ?? "")}</td>
                  <td className="p-2">{String(r.alert_message ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
