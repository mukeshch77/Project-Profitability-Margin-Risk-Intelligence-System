"use client";

import { ChangeEvent, useState } from "react";
import EmptyState from "../../components/empty-state";
import LoadingSpinner from "../../components/loading-spinner";
import Nav from "../../components/nav";
import RiskBadge from "../../components/risk-badge";
import { predict } from "../../lib/api";

type Prediction = Record<string, unknown> | null;

type FormState = {
  budget: string;
  actual_cost: string;
  team_size: string;
  schedule_delay: string;
  labor_cost: string;
  resource_utilization: string;
  project_duration: string;
};

const initial: FormState = {
  budget: "",
  actual_cost: "",
  team_size: "",
  schedule_delay: "",
  labor_cost: "",
  resource_utilization: "",
  project_duration: "",
};

const placeholders: Record<keyof FormState, string> = {
  budget: "e.g. 120000",
  actual_cost: "e.g. 140000",
  team_size: "e.g. 8",
  schedule_delay: "e.g. 12",
  labor_cost: "e.g. 35000",
  resource_utilization: "e.g. 0.72",
  project_duration: "e.g. 6",
};

function toNumberPayload(form: FormState) {
  return {
    budget: Number(form.budget),
    actual_cost: Number(form.actual_cost),
    team_size: Number(form.team_size),
    schedule_delay: Number(form.schedule_delay),
    labor_cost: Number(form.labor_cost),
    resource_utilization: Number(form.resource_utilization),
    project_duration: Number(form.project_duration),
  };
}

export default function PredictPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [result, setResult] = useState<Prediction>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = evt.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const payload = toNumberPayload(form);
      const required = Object.values(payload).every((v) => Number.isFinite(v));
      if (!required) {
        throw new Error("Please fill all fields with valid numbers.");
      }
      const res = await predict(payload);
      setResult(res);
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const uploadData = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".csv")) {
        const [headerLine, valueLine] = text.trim().split(/\r?\n/);
        if (!headerLine || !valueLine) throw new Error("CSV must contain header and one row");

        const headers = headerLine.split(",").map((x) => x.trim());
        const values = valueLine.split(",").map((x) => x.trim());
        const obj = headers.reduce<Record<string, string>>((acc, key, i) => {
          acc[key] = values[i] ?? "";
          return acc;
        }, {});
        setForm((prev) => ({ ...prev, ...(obj as Partial<FormState>) }));
      } else {
        const parsed = JSON.parse(text) as Partial<FormState>;
        setForm((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")])) }));
      }
    } catch {
      setError("Invalid file. Upload JSON or one-row CSV.");
    }
  };

  const causes = Array.isArray(result?.root_causes) ? (result?.root_causes as string[]) : [];
  const confidence = Number(result?.risk_probability ?? 0) * 100;

  return (
    <div>
      <Nav />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="text-lg font-semibold">Predict Project Risk</h2>
          <p className="mb-4 text-sm text-ink/70">Enter project details or upload JSON/CSV to get an instant risk explanation.</p>

          <div className="mb-3">
            <input type="file" accept="application/json,.json,.csv,text/csv" onChange={uploadData} className="block w-full text-sm" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(initial).map((k) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block capitalize">{k.replace(/_/g, " ")}</span>
                <input
                  name={k}
                  value={form[k as keyof FormState]}
                  onChange={onChange}
                  className="w-full rounded-md border border-ink/20 bg-white px-3 py-2"
                  type="number"
                  step="any"
                  placeholder={placeholders[k as keyof FormState]}
                />
              </label>
            ))}
          </div>

          <button onClick={submit} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-[#b93f19]">
            Run Prediction
          </button>

          {loading ? <div className="mt-3"><LoadingSpinner label="Scoring project" /></div> : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="panel p-4">
          <h2 className="text-lg font-semibold">Prediction Summary</h2>

          {!result && !loading ? (
            <div className="mt-3">
              <EmptyState
                title="No prediction yet"
                description="Submit project details to see risk level, reasons, and practical suggestions."
              />
            </div>
          ) : null}

          {result ? (
            <div className="mt-3 space-y-3 text-sm">
              <p>
                <strong>Risk Level:</strong> <RiskBadge level={String(result.risk_level ?? "LOW")} />
              </p>
              <p>
                <strong>Confidence:</strong> {confidence.toFixed(1)}%
              </p>
              <p className="text-ink/70">Prediction based on historical data patterns.</p>

              <div>
                <p className="font-semibold">Why this project is rated this way:</p>
                <ul className="list-disc pl-5">
                  {causes.length > 0 ? causes.map((c, idx) => <li key={idx}>{c}</li>) : <li>No major risk cause detected</li>}
                </ul>
              </div>

              <div>
                <p className="font-semibold">Suggestions:</p>
                <ul className="list-disc pl-5">
                  <li>Reduce delivery delays to prevent overhead growth.</li>
                  <li>Optimize cost allocation against approved budget.</li>
                  <li>Improve resource utilization on billable work.</li>
                </ul>
              </div>

              <p>
                <strong>Top Cause:</strong> {String(result.top_risk_cause ?? "-")}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
