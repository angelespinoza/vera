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
      className={`flex scroll-mt-6 flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-card p-5 shadow-sm ${className}`}
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

export interface NavSection {
  id: string;
  label: string;
  icon: ReactNode;
}

/** Sidebar fija de navegación entre secciones (desktop). Ancla a los `id` de cada Card. */
export function Sidebar({ companyName, sections }: { companyName: string; sections: NavSection[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-sidebar p-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          V
        </span>
        <span className="text-lg font-semibold">Vera</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-foreground"
          >
            {s.icon}
            {s.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-muted p-3 text-xs text-text-secondary">
        <p className="truncate font-medium text-foreground">{companyName}</p>
        <p>Stellar testnet · CFO Agent</p>
      </div>
    </aside>
  );
}

/** Nav horizontal de respaldo para mobile (la sidebar se oculta bajo `md`). */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav className="sticky top-0 z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-border-subtle bg-background/95 px-6 py-2 backdrop-blur md:hidden">
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

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
            {icon}
          </span>
        )}
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && (
        <span className="w-fit rounded-full bg-surface-card px-2 py-0.5 text-xs text-text-secondary">
          {hint}
        </span>
      )}
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
