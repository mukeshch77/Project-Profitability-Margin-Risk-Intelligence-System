export default function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink/70">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      <span>{label}...</span>
    </div>
  );
}
