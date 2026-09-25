"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";

/** Path con radio distinto por esquina — para redondear solo el extremo de dato de una barra apilada. */
function roundedRectPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number): string {
  const rtl = Math.min(tl, w / 2, h / 2);
  const rtr = Math.min(tr, w / 2, h / 2);
  const rbr = Math.min(br, w / 2, h / 2);
  const rbl = Math.min(bl, w / 2, h / 2);
  return `M${x + rtl},${y}
    H${x + w - rtr} Q${x + w},${y} ${x + w},${y + rtr}
    V${y + h - rbr} Q${x + w},${y + h} ${x + w - rbr},${y + h}
    H${x + rbl} Q${x},${y + h} ${x},${y + h - rbl}
    V${y + rtl} Q${x},${y} ${x + rtl},${y}
    Z`;
}

/** Redondea el tope de la escala a un número "limpio" para los ticks del eje Y. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

interface Tooltip {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; colorVar?: string }[];
}

function ChartTooltip({ tooltip }: { tooltip: Tooltip | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-card p-2 text-xs shadow-md"
      style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-medium text-foreground">{tooltip.title}</p>
      {tooltip.rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5 text-text-secondary">
          {r.colorVar && (
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: r.colorVar }} aria-hidden />
          )}
          {r.label}: <strong className="text-foreground tabular-nums">{r.value}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * Anillo de progreso para la confianza de cumplimiento de Jev en un gasto —
 * mismo patrón que un "meter" (marks-and-anatomy.md): el color del relleno
 * refleja el estado real de la decisión, la pista es un paso más claro del
 * borde neutro.
 */
export function ComplianceRing({ fraction, colorVar }: { fraction: number; colorVar: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = c * (1 - clamped);
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth={4}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{Math.round(clamped * 100)}%</span>
    </div>
  );
}

export interface CategorySeries {
  key: string;
  label: string;
  colorVar: string;
}

export interface CategoryWeek {
  label: string;
  values: Record<string, number>;
}

/**
 * Barras apiladas: gasto (USD) por categoría, por semana. Sigue el skill de
 * dataviz — barras ≤24px, extremo de dato redondeado 4px (solo el segmento
 * superior de cada pila), separador de 2px entre segmentos, grid hairline,
 * leyenda siempre presente (≥2 series), tooltip por segmento.
 */
export function CategorySpendChart({ weeks, categories }: { weeks: CategoryWeek[]; categories: CategorySeries[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const width = 700;
  const height = 280;
  const margin = { top: 12, right: 8, bottom: 28, left: 48 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const totals = weeks.map((w) => categories.reduce((acc, c) => acc + (w.values[c.key] ?? 0), 0));
  const maxTotal = niceCeil(Math.max(1, ...totals));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxTotal * f));

  const bandWidth = plotW / weeks.length;
  const barWidth = Math.min(24, bandWidth * 0.55);
  const gap = 2;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Gasto por categoría y semana">
        {yTicks.map((t) => {
          const y = margin.top + plotH - (t / maxTotal) * plotH;
          return (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
                {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
              </text>
            </g>
          );
        })}

        {weeks.map((w, i) => {
          const bandX = margin.left + i * bandWidth;
          const barX = bandX + (bandWidth - barWidth) / 2;
          let cursorY = margin.top + plotH;
          const nonZero = categories.filter((c) => (w.values[c.key] ?? 0) > 0);
          return (
            <g key={w.label}>
              {nonZero.map((c, segIdx) => {
                const value = w.values[c.key] ?? 0;
                const segH = Math.max(0, (value / maxTotal) * plotH - (segIdx > 0 ? gap : 0));
                const isTop = segIdx === nonZero.length - 1;
                const y = cursorY - segH;
                cursorY = y - gap;
                const path = roundedRectPath(barX, y, barWidth, segH, isTop ? 4 : 0, isTop ? 4 : 0, 0, 0);
                return (
                  <path
                    key={c.key}
                    d={path}
                    fill={c.colorVar}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseMove={(e: ReactMouseEvent<SVGPathElement>) => {
                      const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                      setTooltip({
                        x: ((barX + barWidth / 2) / width) * rect.width,
                        y: ((y) / height) * rect.height,
                        title: w.label,
                        rows: [{ label: c.label, value: `$${value.toFixed(2)}`, colorVar: c.colorVar }],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
              <text x={bandX + bandWidth / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
                {w.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {categories.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.colorVar }} aria-hidden />
            {c.label}
          </span>
        ))}
      </div>

      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}

export interface OutcomeWeek {
  label: string;
  approved: number;
  review: number;
  rejected: number;
}

const OUTCOME_SERIES = [
  { key: "approved" as const, label: "Aprobado", icon: "✓", colorVar: "var(--status-good)" },
  { key: "review" as const, label: "Revisión", icon: "!", colorVar: "var(--status-warning)" },
  { key: "rejected" as const, label: "Rechazado", icon: "✕", colorVar: "var(--status-critical)" },
];

/**
 * Líneas: conteo de gastos por veredicto (aprobado/revisión/rechazado), por
 * semana. Usa la paleta de estado reservada (nunca colores categóricos) con
 * ícono + etiqueta en la leyenda, crosshair al pasar el cursor, un tooltip
 * con las tres series a la vez.
 */
export function OutcomeTrendChart({ weeks }: { weeks: OutcomeWeek[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 700;
  const height = 280;
  const margin = { top: 12, right: 12, bottom: 28, left: 40 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const maxValue = niceCeil(Math.max(1, ...weeks.flatMap((w) => [w.approved, w.review, w.rejected])));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));

  const stepX = weeks.length > 1 ? plotW / (weeks.length - 1) : 0;
  const xFor = (i: number) => margin.left + i * stepX;
  const yFor = (v: number) => margin.top + plotH - (v / maxValue) * plotH;

  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Gastos por veredicto y semana">
        {yTicks.map((t) => {
          const y = yFor(t);
          return (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
                {t}
              </text>
            </g>
          );
        })}

        {hoverIdx !== null && (
          <line
            x1={xFor(hoverIdx)}
            x2={xFor(hoverIdx)}
            y1={margin.top}
            y2={margin.top + plotH}
            stroke="var(--text-secondary)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {OUTCOME_SERIES.map((s) => (
          <path
            key={s.key}
            d={linePath(weeks.map((w) => w[s.key]))}
            fill="none"
            stroke={s.colorVar}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {OUTCOME_SERIES.map((s) =>
          weeks.map((w, i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={xFor(i)}
              cy={yFor(w[s.key])}
              r={4}
              fill={s.colorVar}
              stroke="var(--surface-card)"
              strokeWidth={2}
            />
          )),
        )}

        {/* Franjas invisibles para detectar la semana más cercana al cursor. */}
        {weeks.map((w, i) => (
          <rect
            key={w.label}
            x={xFor(i) - stepX / 2}
            y={margin.top}
            width={stepX || plotW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}

        {weeks.map((w, i) => (
          <text key={w.label} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
            {w.label}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {OUTCOME_SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.colorVar }} aria-hidden />
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </span>
        ))}
      </div>

      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-card p-2 text-xs shadow-md"
          style={{
            left: `${(xFor(hoverIdx) / width) * 100}%`,
            top: `${(margin.top / height) * 100}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-medium text-foreground">{weeks[hoverIdx].label}</p>
          {OUTCOME_SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-text-secondary">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: s.colorVar }} aria-hidden />
              {s.label}: <strong className="text-foreground tabular-nums">{weeks[hoverIdx][s.key]}</strong>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
