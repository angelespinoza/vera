"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export interface NavSection {
  id: string;
  label: string;
  icon: ReactNode;
  /** Ruta real de la página (cada sección es su propia página, no un ancla). */
  href: string;
  /** Conteo opcional para mostrar como insignia junto a la sección (ej. gastos pendientes). */
  badge?: number;
}

/** Sidebar fija de navegación entre páginas (desktop). Resalta la página activa. */
export function Sidebar({ companyName, sections }: { companyName: string; sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-sidebar p-4 md:flex">
      <div className="flex items-center gap-2 px-2 pb-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          V
        </span>
        <span className="text-lg font-semibold">Vera</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {sections.map((s) => {
          const active = pathname === s.href;
          return (
            <a
              key={s.id}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-surface-muted text-foreground"
                  : "text-text-secondary hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-3">
                {s.icon}
                {s.label}
              </span>
              {!!s.badge && (
                <span className="rounded-full bg-status-warning/20 px-1.5 py-0.5 text-[11px] font-semibold text-status-warning">
                  {s.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-muted p-3 text-xs text-text-secondary">
        <p className="truncate font-medium text-foreground">{companyName}</p>
        <p>Stellar testnet · CFO Agent</p>
      </div>
    </aside>
  );
}

/** Nav horizontal de respaldo para mobile (la sidebar se oculta bajo `md`). */
export function SectionNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-border-subtle bg-background/95 px-6 py-2 backdrop-blur md:hidden">
      {sections.map((s) => {
        const active = pathname === s.href;
        return (
          <a
            key={s.id}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              active ? "bg-surface-muted text-foreground" : "text-text-secondary hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {s.label}
            {!!s.badge && <span className="ml-1 text-status-warning">({s.badge})</span>}
          </a>
        );
      })}
    </nav>
  );
}
