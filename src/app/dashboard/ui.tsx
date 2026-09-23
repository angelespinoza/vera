import type { ReactNode } from "react";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-sm ${className}`}
    >
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-muted px-4 py-3">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; colorClass: string }> = {
  APPROVED: { label: "Aprobado", icon: "✓", colorClass: "text-status-good" },
  REJECTED: { label: "Rechazado", icon: "✕", colorClass: "text-status-critical" },
  REVIEW_REQUIRED: { label: "Requiere revisión", icon: "!", colorClass: "text-status-warning" },
};

/** Insignia de estado: nunca solo color — siempre ícono + etiqueta (dataviz skill). */
export function StatusBadge({ outcome }: { outcome: string }) {
  const config = STATUS_CONFIG[outcome] ?? { label: outcome, icon: "•", colorClass: "text-text-secondary" };
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold ${config.colorClass}`}>
      <span aria-hidden>{config.icon}</span>
      {config.label.toUpperCase()}
    </span>
  );
}
