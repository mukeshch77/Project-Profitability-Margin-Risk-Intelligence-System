export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink/25 bg-white/70 p-6 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink/65">{description}</p>
    </div>
  );
}
