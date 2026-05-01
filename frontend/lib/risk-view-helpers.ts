import type { WatchlistRow } from "./api";

const COST_KEYWORDS = ["cost", "budget", "overrun"];
const DELAY_KEYWORDS = ["delay", "schedule"];
const PERFORMANCE_KEYWORDS = ["efficiency", "utilization", "productivity"];

function splitCauses(value: string): string[] {
  return value
    .split(/[,;|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function deriveIssueTag(text: string): "COST ISSUE" | "DELAY ISSUE" | "PERFORMANCE ISSUE" | "" {
  const lower = normalize(text);
  if (COST_KEYWORDS.some((keyword) => lower.includes(keyword))) return "COST ISSUE";
  if (DELAY_KEYWORDS.some((keyword) => lower.includes(keyword))) return "DELAY ISSUE";
  if (PERFORMANCE_KEYWORDS.some((keyword) => lower.includes(keyword))) return "PERFORMANCE ISSUE";
  return "";
}

export function filterRedundantCauses(rootCauses: string[], tag: string): string[] {
  const normalizedTag = (tag ?? "").toUpperCase();
  let keywords: string[] = [];

  if (normalizedTag.includes("COST ISSUE")) keywords = COST_KEYWORDS;
  else if (normalizedTag.includes("DELAY ISSUE")) keywords = DELAY_KEYWORDS;
  else if (normalizedTag.includes("PERFORMANCE ISSUE")) keywords = PERFORMANCE_KEYWORDS;
  else return rootCauses;

  return rootCauses.filter((cause) => {
    const lowerCause = normalize(cause);
    return !keywords.some((keyword) => lowerCause.includes(keyword));
  });
}

export function getDisplayCauses(row: WatchlistRow): string[] {
  const seen = new Set<string>();
  const combined = [row.top_risk_cause, ...splitCauses(row.root_causes ?? "")]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = normalize(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const tag = deriveIssueTag(`${row.top_risk_cause} ${row.root_causes}`);
  const filtered = filterRedundantCauses(combined, tag);
  return filtered.length > 0 ? filtered.slice(0, 3) : combined.slice(0, 3);
}

export function dedupeTextList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const key = normalize(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item.trim());
  }

  return result;
}

export function dedupeAlerts<T extends Record<string, unknown>>(alerts: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const alert of alerts) {
    const projectId = String(alert.project_id ?? "");
    const message = String(alert.alert_message ?? alert.message ?? alert.alert_type ?? alert.alerts ?? "");
    const key = `${projectId}::${normalize(message)}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(alert);
  }

  return result;
}

function toTime(createdAt: string | null): number {
  if (!createdAt) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function groupLatestByProject(rows: WatchlistRow[]): WatchlistRow[] {
  const latest = new Map<number, WatchlistRow>();

  for (const row of rows) {
    const existing = latest.get(row.project_id);
    if (!existing) {
      latest.set(row.project_id, row);
      continue;
    }

    const rowTime = toTime(row.created_at);
    const existingTime = toTime(existing.created_at);

    if (rowTime > existingTime || (rowTime === existingTime && row.risk_probability > existing.risk_probability)) {
      latest.set(row.project_id, row);
    }
  }

  return Array.from(latest.values());
}
