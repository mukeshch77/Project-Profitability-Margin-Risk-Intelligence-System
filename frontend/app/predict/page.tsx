"use client";

import { ChangeEvent, useState } from "react";
import EmptyState from "../../components/empty-state";
import LoadingSpinner from "../../components/loading-spinner";
import Nav from "../../components/nav";
import RiskBadge from "../../components/risk-badge";
import { predict, simulate, type PredictResponse, type SimulateResponse } from "../../lib/api";
import { dedupeTextList } from "../../lib/risk-view-helpers";

type Prediction = PredictResponse | null;

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
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [simInputs, setSimInputs] = useState({
    actual_cost: "",
    schedule_delay: "",
    team_size: "",
  });

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
      setSimulation(null);
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
      setResult(null);
      setSimulation(null);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    setError("");
    setSimulateLoading(true);
    try {
      const base = toNumberPayload(form);
      const payload = {
        ...base,
        actual_cost: simInputs.actual_cost ? Number(simInputs.actual_cost) : base.actual_cost,
        schedule_delay: simInputs.schedule_delay ? Number(simInputs.schedule_delay) : base.schedule_delay,
        team_size: simInputs.team_size ? Number(simInputs.team_size) : base.team_size,
      };

      const required = Object.values(payload).every((v) => Number.isFinite(v));
      if (!required) {
        throw new Error("Please provide valid values before simulation.");
      }

      const simulated = await simulate(payload);
      setSimulation(simulated);
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
      setSimulation(null);
    } finally {
      setSimulateLoading(false);
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

  const causesRaw = Array.isArray(result?.root_causes) ? (result?.root_causes as string[]) : [];
  const causes = dedupeTextList(causesRaw).slice(0, 3);
  const actions = dedupeTextList(Array.isArray(result?.suggestions) ? result.suggestions : []).slice(0, 3);
  const confidence = Number(result?.risk_probability ?? 0) * 100;
  const simulatedConfidence = Number(simulation?.risk_probability ?? 0) * 100;
  const diff = result && simulation ? simulation.risk_probability - result.risk_probability : null;
  const comparisonLabel = diff === null ? "" : diff < 0 ? "Improved ↓" : diff > 0 ? "Worse ↑" : "No Change";
  const comparisonClass = diff === null ? "text-ink/70" : diff < 0 ? "text-green-700" : diff > 0 ? "text-red-700" : "text-ink/70";

  return (
    <div>
      <Nav />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="text-lg font-semibold">Project Input</h2>
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
            Check Project
          </button>

          {loading ? <div className="mt-3"><LoadingSpinner label="Scoring project" /></div> : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="panel p-4">
          <h2 className="text-lg font-semibold">Project Result</h2>

          {!result && !loading ? (
            <div className="mt-3">
              <EmptyState
                title="No prediction yet"
                description="Submit project details to see chance of problem, main issues, and next steps."
              />
            </div>
          ) : null}

          {result ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-xl border border-ink/15 bg-white p-4">
                <p className="text-sm text-ink/70">Risk Level</p>
                <p className="mt-1 text-xl font-semibold"><RiskBadge level={String(result.risk_level ?? "LOW")} /></p>
                <p className="mt-3 text-sm text-ink/70">Chance of Problem</p>
                <p className="mt-1 text-2xl font-bold">{confidence.toFixed(1)}%</p>
                <p className="mt-2 text-xs text-ink/65">This shows how likely the project is to face problems.</p>
              </div>

              <div className="rounded-xl border border-ink/15 bg-white p-4">
                <p className="font-semibold">Why is this happening?</p>
                <ul className="list-disc pl-5">
                  {causes.length > 0 ? causes.map((c, idx) => <li key={idx}>{c}</li>) : <li>No major risk cause detected</li>}
                </ul>
              </div>

              <div className="rounded-xl border border-ink/15 bg-white p-4">
                <p className="font-semibold">What You Should Do</p>
                <ul className="list-disc pl-5">
                  {actions.length > 0 ? (
                    actions.map((s, idx) => <li key={idx}>{s}</li>)
                  ) : (
                    <li>No suggestions generated</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-ink/15 bg-white p-4">
                <p className="font-semibold">Quick Summary</p>
                <p>{String(result.summary ?? result.explanation ?? "-")}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-4 panel p-4">
        <h2 className="text-lg font-semibold">Try Changes (What If?)</h2>
        <p className="mb-4 text-sm text-ink/70">Adjust cost, delay, and team size to compare original vs simulated risk.</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block">Cost (actual_cost)</span>
            <input
              value={simInputs.actual_cost}
              onChange={(e) => setSimInputs((prev) => ({ ...prev, actual_cost: e.target.value }))}
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2"
              type="number"
              step="any"
              placeholder={form.actual_cost || "e.g. 130000"}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Delay (schedule_delay)</span>
            <input
              value={simInputs.schedule_delay}
              onChange={(e) => setSimInputs((prev) => ({ ...prev, schedule_delay: e.target.value }))}
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2"
              type="number"
              step="any"
              placeholder={form.schedule_delay || "e.g. 8"}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Team Size</span>
            <input
              value={simInputs.team_size}
              onChange={(e) => setSimInputs((prev) => ({ ...prev, team_size: e.target.value }))}
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2"
              type="number"
              step="1"
              placeholder={form.team_size || "e.g. 10"}
            />
          </label>
        </div>

        <button onClick={runSimulation} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
          Try Changes
        </button>

        {simulateLoading ? <div className="mt-3"><LoadingSpinner label="Running simulation" /></div> : null}

        {simulation ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-ink/15 bg-white p-3 text-sm">
              <p className="text-ink/70">Original Risk</p>
              <p className="mt-1 text-lg font-semibold">
                {result ? `${confidence.toFixed(1)}% (${result.risk_level})` : "Run prediction first"}
              </p>
            </div>
            <div className="rounded-xl border border-ink/15 bg-white p-3 text-sm">
              <p className="text-ink/70">New Risk</p>
              <p className="mt-1 text-lg font-semibold">
                {simulatedConfidence.toFixed(1)}% ({simulation.risk_level})
                {result ? <span className={`ml-2 text-sm font-medium ${comparisonClass}`}>{comparisonLabel}</span> : null}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
