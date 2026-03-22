const riskStyles: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

export default function RiskBadge({ level }: { level: string }) {
  const normalized = level.toUpperCase();
  const cls = riskStyles[normalized] ?? riskStyles.LOW;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{normalized}</span>;
}
