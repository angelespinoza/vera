"use client";

import { useState, type ReactNode } from "react";

/**
 * Fila de tabla que se puede expandir para mostrar detalle debajo — el
 * contenido de ambas partes se sigue calculando en el Server Component
 * (se pasa como children ya renderizado), esto solo añade el toggle.
 */
export function ExpandableRow({
  summary,
  detail,
  colSpan,
}: {
  summary: ReactNode;
  detail: ReactNode;
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border-subtle hover:bg-surface-muted"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {summary}
      </tr>
      {open && (
        <tr className="border-b border-border-subtle bg-surface-muted">
          <td colSpan={colSpan} className="p-3 text-xs">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
