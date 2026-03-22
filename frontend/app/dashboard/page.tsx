"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import EmptyState from "../../components/empty-state";
import LoadingSpinner from "../../components/loading-spinner";
import Modal from "../../components/modal";
import Nav from "../../components/nav";
import RiskBadge from "../../components/risk-badge";
import {
  getAlerts,
  getExplanation,
  getHealth,
  getWatchlist,
  type ExplainResponse,
  type HealthResponse,
  type WatchlistRow,
} from "../../lib/api";

type AlertRow = Record<string, unknown>;

type TrendPoint = {
  name: string;
  overrun: number;
};

type BubblePoint = {
  delay: number;
  overrun: number;
  riskPct: number;
};

function normalizeWatchlist(rows: Record<string, unknown>[]): WatchlistRow[] {
  return rows.map((r) => ({
    project_id: Number(r.project_id ?? 0),
    budget: Number(r.budget ?? 0),
    actual_cost: Number(r.actual_cost ?? 0),
    team_size: Number(r.team_size ?? 0),
    schedule_delay: Number(r.schedule_delay ?? 0),
    labor_cost: Number(r.labor_cost ?? 0),
    resource_utilization: Number(r.resource_utilization ?? 0),
    project_duration: Number(r.project_duration ?? 0),
    cost_overrun_pct: Number(r.cost_overrun_pct ?? 0),
    risk_probability: Number(r.risk_probability ?? 0),
    risk_level: String(r.risk_level ?? r.alert_level ?? "LOW").toUpperCase(),
    alert_level: String(r.alert_level ?? r.risk_level ?? "LOW").toUpperCase(),
    top_risk_cause: String(r.top_risk_cause ?? ""),
    root_causes: String(r.root_causes ?? ""),
    created_at: r.created_at ? String(r.created_at) : null,
  }));
}

function averageRiskByTeamSize(rows: WatchlistRow[]) {
  const grouped = new Map<number, number[]>();
  rows.forEach((r) => {
    const key = r.team_size;
    const arr = grouped.get(key) ?? [];
    arr.push(r.risk_probability * 100);
    grouped.set(key, arr);
  });

  return [...grouped.entries()]
    .map(([teamSize, values]) => ({
      teamSize,
      avgRisk: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.teamSize - b.teamSize);
}

function riskColor(riskPct: number) {
  if (riskPct >= 70) return "#dc2626";
  if (riskPct >= 45) return "#eab308";
  return "#16a34a";
}

export default function DashboardPage() {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [showCostHelp, setShowCostHelp] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getWatchlist(), getAlerts(), getHealth()])
      .then(([w, a, h]) => {
        setRows(normalizeWatchlist(w.rows));
        setAlerts(a.rows);
        setHealth(h);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (riskFilter === "ALL") return rows;
    return rows.filter((r) => r.risk_level === riskFilter);
  }, [rows, riskFilter]);

  const distribution = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    rows.forEach((r) => {
      if (r.risk_level in counts) counts[r.risk_level as keyof typeof counts] += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const overrunTrend = useMemo<TrendPoint[]>(
    () =>
      filtered.slice(0, 25).map((r, i) => ({
        name: r.project_id ? `#${r.project_id}` : `P${i + 1}`,
        overrun: r.cost_overrun_pct * 100,
      })),
    [filtered]
  );

  const teamTrend = useMemo(() => averageRiskByTeamSize(filtered), [filtered]);

  const bubbles = useMemo<BubblePoint[]>(
    () =>
      filtered.slice(0, 60).map((r) => ({
        delay: r.schedule_delay,
        overrun: r.cost_overrun_pct * 100,
        riskPct: r.risk_probability * 100,
      })),
    [filtered]
  );

  const openExplanation = async (projectId: number) => {
    try {
      setExplainLoading(true);
      setExplainOpen(true);
      const details = await getExplanation(projectId);
      setExplanation(details);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div>
      <Nav />
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading dashboard insights" /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          title="No projects available yet"
          description="Run a prediction from the Predict page to start seeing business-friendly risk insights here."
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="panel interactive-panel p-4">
              <p className="text-xs uppercase tracking-wider text-ink/60">Total Projects</p>
              <p className="mt-1 text-3xl font-semibold">{rows.length}</p>
            </div>
            <div className="panel interactive-panel p-4">
              <p className="text-xs uppercase tracking-wider text-ink/60">High Risk</p>
              <p className="mt-1 text-3xl font-semibold text-red-700">{distribution.find((d) => d.name === "HIGH")?.value ?? 0}</p>
            </div>
            <div className="panel interactive-panel p-4">
              <p className="text-xs uppercase tracking-wider text-ink/60">Active Alerts</p>
              <p className="mt-1 text-3xl font-semibold">{alerts.length}</p>
            </div>
            <div className="panel interactive-panel p-4">
              <p className="text-xs uppercase tracking-wider text-ink/60">Model Status</p>
              <p className={`mt-1 text-xl font-semibold ${health?.model_loaded ? "text-mint" : "text-red-600"}`}>
                {health === null ? "Checking" : health.model_loaded ? "Online" : "Offline"}
              </p>
            </div>
          </section>

          <section className="mt-5 flex flex-wrap gap-2">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRiskFilter(f)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  riskFilter === f ? "border-ink bg-ink text-white" : "border-ink/25 bg-white"
                }`}
              >
                {f}
              </button>
            ))}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="panel p-4">
              <h2 className="mb-3 text-lg font-semibold">Project Risk Distribution</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value">
                      {distribution.map((d) => (
                        <Cell key={d.name} fill={d.name === "HIGH" ? "#dc2626" : d.name === "MEDIUM" ? "#eab308" : "#16a34a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Cost Overrun Trend</h2>
                <button onClick={() => setShowCostHelp(true)} className="rounded-full border border-ink/25 px-3 py-1 text-xs">
                  What is this?
                </button>
              </div>
              <p className="mb-2 text-xs text-ink/65">Over Budget &gt; 0%, Under Budget &lt; 0%</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overrunTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="overrun" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="panel p-4">
              <h2 className="mb-1 text-lg font-semibold">Risk by Team Size</h2>
              <p className="mb-3 text-sm text-ink/65">Shows how team size affects risk probability.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={teamTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="teamSize" label={{ value: "Team Size", position: "insideBottom", offset: -5 }} />
                    <YAxis unit="%" label={{ value: "Avg Risk", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgRisk" stroke="#7c3aed" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="mb-1 text-lg font-semibold">Delay vs Cost Overrun Bubble View</h2>
              <p className="mb-3 text-sm text-ink/65">Color intensity represents risk probability.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="delay" name="Delay" unit="d" />
                    <YAxis type="number" dataKey="overrun" name="Cost Overrun" unit="%" />
                    <ZAxis type="number" dataKey="riskPct" range={[80, 300]} />
                    <Tooltip />
                    <Scatter data={bubbles}>
                      {bubbles.map((b, i) => (
                        <Cell key={i} fill={riskColor(b.riskPct)} fillOpacity={0.75} />
                      ))}
                    </Scatter>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-ink/65">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Low</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Medium</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> High</span>
              </div>
            </div>
          </section>

          <section className="mt-6 panel p-4">
            <h2 className="mb-3 text-lg font-semibold">Projects Overview</h2>
            {filtered.length === 0 ? (
              <EmptyState title="No projects in this filter" description="Try selecting another risk filter to view projects." />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/15 text-left">
                      <th className="p-2">Project ID</th>
                      <th className="p-2">Risk</th>
                      <th className="p-2">Cause</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 20).map((r) => (
                      <tr key={r.project_id} className="border-b border-ink/10 align-top">
                        <td className="p-2">#{r.project_id}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <RiskBadge level={r.risk_level} />
                            <span>{(r.risk_probability * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-2">{r.top_risk_cause || "No clear cause"}</td>
                        <td className="p-2">
                          <button
                            onClick={() => openExplanation(r.project_id)}
                            className="rounded-full border border-ink/25 px-3 py-1 text-xs hover:bg-ink/5"
                          >
                            View Explanation
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6 panel p-4">
            <h2 className="mb-3 text-lg font-semibold">Early Warning Alerts</h2>
            {alerts.length === 0 ? (
              <EmptyState title="No active alerts" description="System is not detecting urgent warning signals at the moment." />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/15 text-left">
                      <th className="p-2">Project ID</th>
                      <th className="p-2">Alert</th>
                      <th className="p-2">Why it triggered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b border-ink/10">
                        <td className="p-2">{String(r.project_id ?? "-")}</td>
                        <td className="p-2">{String(r.alert_type ?? r.alerts ?? "")}</td>
                        <td className="p-2">{String(r.alert_message ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <Modal open={showCostHelp} onClose={() => setShowCostHelp(false)} title="Cost Overrun Trend">
        This graph shows how much actual cost exceeded budget over time. Values above zero mean over budget,
        and values below zero mean under budget.
      </Modal>

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="Project Explanation">
        {explainLoading ? (
          <LoadingSpinner label="Loading explanation" />
        ) : explanation ? (
          <div className="space-y-2">
            <p>
              <strong>Risk:</strong> {(explanation.risk_probability * 100).toFixed(1)}% ({explanation.risk_level})
            </p>
            <p>
              <strong>Main reason:</strong> {explanation.top_risk_cause}
            </p>
            <div>
              <p className="font-semibold">Top 3 factors:</p>
              <ul className="list-disc pl-5">
                {explanation.shap_top_features.map((item, idx) => (
                  <li key={idx}>
                    {item.feature} contributes {item.impact_pct.toFixed(1)}% to this risk prediction.
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-ink/65">Prediction based on historical data patterns from similar projects.</p>
          </div>
        ) : (
          <EmptyState title="No explanation data" description="Try again after selecting a valid project." />
        )}
      </Modal>
    </div>
  );
}
