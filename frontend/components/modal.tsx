import { ReactNode } from "react";

export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-ink/20 px-2 py-1 text-sm text-ink/70 hover:bg-ink/5"
          >
            Close
          </button>
        </div>
        <div className="text-sm text-ink/85">{children}</div>
      </div>
    </div>
  );
}
