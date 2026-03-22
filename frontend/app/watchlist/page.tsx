"use client";

import { useEffect, useState } from "react";
import EmptyState from "../../components/empty-state";
import LoadingSpinner from "../../components/loading-spinner";
import Modal from "../../components/modal";
import Nav from "../../components/nav";
import RiskBadge from "../../components/risk-badge";
import { getExplanation, getWatchlist, type ExplainResponse, type WatchlistRow } from "../../lib/api";

function normalize(rows: Record<string, unknown>[]): WatchlistRow[] {
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

function Section({
  title,
  rows,
  onExplain,
}: {
  title: string;
  rows: WatchlistRow[];
  onExplain: (id: number) => void;
}) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-ink/65">{rows.length} projects</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No projects" description="No projects in this risk category right now." />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left">
                <th className="p-2">Project ID</th>
                <th className="p-2">Risk %</th>
                <th className="p-2">Root Cause</th>
                <th className="p-2">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${title}-${r.project_id}`} className="border-b border-ink/10 align-top">
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
                      onClick={() => onExplain(r.project_id)}
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
  );
}

export default function WatchlistPage() {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getWatchlist()
      .then((data) => setRows(normalize(data.rows)))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const byLevel = {
    HIGH: rows.filter((r) => r.risk_level === "HIGH"),
    MEDIUM: rows.filter((r) => r.risk_level === "MEDIUM"),
    LOW: rows.filter((r) => r.risk_level === "LOW"),
  };

  const openExplanation = async (projectId: number) => {
    try {
      setExplainOpen(true);
      setExplainLoading(true);
      const res = await getExplanation(projectId);
      setExplain(res);
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
      {loading ? <LoadingSpinner label="Loading projects" /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState title="No projects to show" description="Generate predictions first to populate this page." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="space-y-5">
          <Section title="HIGH RISK" rows={byLevel.HIGH} onExplain={openExplanation} />
          <Section title="MEDIUM RISK" rows={byLevel.MEDIUM} onExplain={openExplanation} />
          <Section title="LOW RISK" rows={byLevel.LOW} onExplain={openExplanation} />
        </div>
      ) : null}

      <Modal open={explainOpen} onClose={() => setExplainOpen(false)} title="Project Explanation">
        {explainLoading ? (
          <LoadingSpinner label="Loading explanation" />
        ) : explain ? (
          <div className="space-y-2">
            <p>
              <strong>Risk:</strong> {(explain.risk_probability * 100).toFixed(1)}% ({explain.risk_level})
            </p>
            <p>
              <strong>Main Cause:</strong> {explain.top_risk_cause}
            </p>
            <ul className="list-disc pl-5">
              {explain.shap_top_features.map((s, idx) => (
                <li key={idx}>
                  {s.feature}: {s.impact_pct.toFixed(1)}% influence
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState title="No data" description="No explanation available for this project." />
        )}
      </Modal>
    </div>
  );
}
