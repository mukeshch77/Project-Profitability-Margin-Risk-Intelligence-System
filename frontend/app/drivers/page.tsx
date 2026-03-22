"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/empty-state";
import LoadingSpinner from "../../components/loading-spinner";
import Nav from "../../components/nav";
import { getDrivers } from "../../lib/api";

type Driver = {
  feature: string;
  importance: number;
};

function toPlainEnglish(feature: string) {
  const map: Record<string, string> = {
    cost_overrun_pct: "Cost overrun",
    delay_intensity: "Long schedule delays",
    resource_utilization: "Resource utilization",
    efficiency_gap: "Team efficiency gap",
    labor_intensity: "High labor intensity",
    revenue_to_cost_ratio: "Revenue to cost balance",
  };

  const label = map[feature] ?? feature.replace(/_/g, " ");
  if (feature === "resource_utilization") return `${label} going down increases risk.`;
  if (feature === "revenue_to_cost_ratio") return `${label} below 1 increases profitability risk.`;
  return `${label} going up increases risk.`;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getDrivers()
      .then((data) => {
        const mapped = data.rows.map((row) => ({
          feature: String(row.feature ?? row.feature_name ?? ""),
          importance: Number(row.importance_mean ?? row.importance_score ?? 0),
        }));
        setDrivers(mapped);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const top = useMemo(() => drivers.slice(0, 6), [drivers]);

  return (
    <div>
      <Nav />
      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Top Factors Affecting Risk</h2>
        <p className="mt-1 text-sm text-ink/65">
          These factors most strongly influence whether a project may face margin pressure.
        </p>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {loading ? <div className="mt-4"><LoadingSpinner label="Loading risk factors" /></div> : null}

        {!loading && top.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No driver data yet" description="Run model training first to generate profitability drivers." />
          </div>
        ) : null}

        {!loading && top.length > 0 ? (
          <ol className="mt-5 space-y-3">
            {top.map((d, idx) => (
              <li key={d.feature} className="interactive-panel rounded-xl border border-ink/10 bg-white p-4">
                <p className="font-semibold text-ink">{idx + 1}. {toPlainEnglish(d.feature)}</p>
                <p className="mt-1 text-sm text-ink/65">Impact score: {(d.importance * 100).toFixed(2)}%</p>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="mt-5 panel p-5">
        <h3 className="text-lg font-semibold">What does this mean?</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/80">
          <li>If project cost rises faster than budget, risk grows quickly.</li>
          <li>Long delays often add hidden overhead and reduce margins.</li>
          <li>Low utilization means teams are not converting effort into billable value.</li>
          <li>Early corrections in these factors can prevent high-risk outcomes.</li>
        </ul>
      </section>
    </div>
  );
}
