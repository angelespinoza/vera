import type { ReactNode } from "react";

export function Card({
  id,
  title,
  badge,
  children,
  className = "",
}: {
  id?: string;
  title?: string;
  /** Insignia corta junto al título, p.ej. un conteo de pendientes. */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-sm ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {badge}
        </div>
      )}
      {children}
    </section>
  );
}

/** Barra de navegación entre secciones — ancla a los `id` de cada Card. */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav className="sticky top-0 z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-border-subtle bg-background/95 px-6 py-2 backdrop-blur md:-mx-8 md:px-8">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted hover:text-foreground"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/** Trunca una clave pública de Stellar para mostrarla sin romper el layout; la clave completa queda en el title. */
export function truncateKey(key: string): string {
  if (key.length <= 16) return key;
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

/** Insignia de conteo para llamar la atención sobre acciones pendientes. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-status-warning/20 px-2 py-0.5 text-xs font-semibold text-status-warning">
      {count} pendiente{count === 1 ? "" : "s"}
    </span>
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
