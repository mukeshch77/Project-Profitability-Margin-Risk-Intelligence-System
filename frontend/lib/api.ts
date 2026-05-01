export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function getApiBase() {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  return API_BASE;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;

  try {
    const res = await fetch(url, {
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Request to ${path} failed: ${error.message}`);
    }

    throw error;
  }
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

export type PredictResponse = {
  risk_probability: number;
  risk_level: string;
  top_risk_cause: string;
  message: string;
  explanation: string;
  suggestions: string[];
  summary: string;
  early_warning_alerts: string[];
  recommended_action: string;
  root_causes: string[];
  shap_top_features: Array<{ feature: string; impact: number; impact_pct: number }>;
};

export type SimulateResponse = {
  risk_probability: number;
  risk_level: string;
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
  return fetchJson<PredictResponse>("/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function simulate(payload: Record<string, unknown>) {
  return fetchJson<SimulateResponse>("/simulate", {
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
