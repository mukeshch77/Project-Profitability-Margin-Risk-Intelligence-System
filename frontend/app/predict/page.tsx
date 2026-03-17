"use client";

import { ChangeEvent, useState } from "react";
import Nav from "../../components/nav";
import { predict } from "../../lib/api";

type Prediction = Record<string, unknown> | null;

const initial = {
  budget: 120000,
  actual_cost: 140000,
  team_size: 8,
  schedule_delay: 12,
  labor_cost: 35000,
  resource_utilization: 0.72,
  project_duration: 6,
};

export default function PredictPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Prediction>(null);
  const [error, setError] = useState("");

  const onChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = evt.target;
    setForm((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const submit = async () => {
    setError("");
    try {
      const res = await predict(form);
      setResult(res);
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
    }
  };

  const uploadData = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".csv")) {
        const [headerLine, valueLine] = text.trim().split(/\r?\n/);
        if (!headerLine || !valueLine) {
          throw new Error("CSV must include header and one data row");
        }
        const headers = headerLine.split(",").map((x) => x.trim());
        const values = valueLine.split(",").map((x) => x.trim());
        const parsed = headers.reduce<Record<string, number>>((acc, key, idx) => {
          const val = Number(values[idx]);
          if (!Number.isNaN(val)) {
            acc[key] = val;
          }
          return acc;
        }, {});
        setForm({ ...initial, ...parsed });
      } else {
        const parsed = JSON.parse(text);
        setForm({ ...initial, ...parsed });
      }
    } catch {
      setError("Invalid file. Upload JSON or CSV with one project row.");
    }
  };

  return (
    <div>
      <Nav />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 animate-rise">
          <h2 className="text-lg font-semibold">Predict Project Margin Risk</h2>
          <p className="mb-4 text-sm text-ink/70">Enter project metrics or upload JSON/CSV payload.</p>
          <div className="mb-3">
            <input type="file" accept="application/json,.json,.csv,text/csv" onChange={uploadData} className="block w-full text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(form).map(([key, value]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block capitalize">{key.replace(/_/g, " ")}</span>
                <input
                  name={key}
                  value={value}
                  onChange={onChange}
                  className="w-full rounded-md border border-ink/20 bg-white px-3 py-2"
                  type="number"
                  step="any"
                />
              </label>
            ))}
          </div>
          <button
            onClick={submit}
            className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-[#b93f19]"
          >
            Run Prediction
          </button>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="panel p-4 animate-rise">
          <h2 className="text-lg font-semibold">Prediction Output</h2>
          {!result ? <p className="mt-2 text-sm text-ink/70">No prediction yet.</p> : null}
          {result ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <strong>Risk Probability:</strong> {(Number(result.risk_probability ?? 0) * 100).toFixed(2)}%
              </p>
              <p>
                <strong>Risk Level:</strong> {String(result.risk_level ?? "")}
              </p>
              <p>
                <strong>Top Risk Cause:</strong> {String(result.top_risk_cause ?? "")}
              </p>
              <p>
                <strong>Message:</strong> {String(result.message ?? "")}
              </p>
              <p>
                <strong>Early Alerts:</strong> {Array.isArray(result.early_warning_alerts) ? result.early_warning_alerts.join(" | ") : ""}
              </p>
              <p>
                <strong>Action:</strong> {String(result.recommended_action ?? "")}
              </p>
              <div>
                <p className="font-semibold">Top SHAP Drivers:</p>
                <ul className="list-disc pl-5">
                  {Array.isArray(result.shap_top_features)
                    ? result.shap_top_features.map((item, idx) => {
                        const it = item as Record<string, unknown>;
                        return (
                          <li key={idx}>
                            {String(it.feature)}: {Number(it.impact_pct ?? 0).toFixed(1)}%
                          </li>
                        );
                      })
                    : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
