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

export type HealthResponse = {
  status: string;
  model_loaded: boolean;
  model_error: string | null;
};

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}
