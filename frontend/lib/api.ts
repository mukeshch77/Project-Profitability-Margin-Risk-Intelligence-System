export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

export type TableResponse = { rows: Record<string, unknown>[] };

export type WatchlistRow = {
  project_id: number;
  budget: number;
  actual_cost: number;
  team_size: number;
  schedule_delay: number;
  labor_cost: number;
  resource_utilization: number;
  project_duration: number;
  cost_overrun_pct: number;
  risk_probability: number;
  risk_level: string;
  alert_level: string;
  top_risk_cause: string;
  root_causes: string;
  created_at: string | null;
};

export type ExplainResponse = {
  project_id: number;
  risk_probability: number;
  risk_level: string;
  top_risk_cause: string;
  shap_top_features: Array<{ feature: string; impact: number; impact_pct: number }>;
};

export function getWatchlist() {
  return fetchJson<TableResponse>("/watchlist");
}

export function getDrivers() {
  return fetchJson<TableResponse>("/profit-drivers");
}

export function getAlerts() {
  return fetchJson<TableResponse>("/alerts");
}

export function predict(payload: Record<string, unknown>) {
  return fetchJson<Record<string, unknown>>("/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getExplanation(projectId: number) {
  return fetchJson<ExplainResponse>(`/explain/${projectId}`);
}

export type HealthResponse = {
  status: string;
  model_loaded: boolean;
  model_error: string | null;
};

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}
