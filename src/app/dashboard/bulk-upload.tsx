"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { processBulkExpenseRow, type BulkRowInput, type BulkRowResult } from "@/app/actions/bulk";
import type { ComparativeOutcome, EngineComparativeResult } from "@/lib/expense/pipeline";
import { StatusBadge } from "./ui";

const MAX_ROWS = 200;

const COLUMN_ALIASES: Record<keyof BulkRowInput, string[]> = {
  employeeEmail: ["empleado", "email", "employee", "employee_email", "correo"],
  merchant: ["comercio", "merchant", "proveedor"],
  amount: ["monto", "amount"],
  currency: ["moneda", "currency"],
  category: ["categoria", "categoría", "category"],
  expenseDate: ["fecha", "date", "expense_date"],
  justification: ["justificacion", "justificación", "justification", "descripcion", "descripción"],
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function findKey(raw: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const key of Object.keys(raw)) {
    if (normalizedAliases.includes(normalizeHeader(key))) return raw[key];
  }
  return undefined;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return value.trim();
  }
  return "";
}

function parseRow(raw: Record<string, unknown>): BulkRowInput {
  const amountRaw = findKey(raw, COLUMN_ALIASES.amount);
  return {
    employeeEmail: String(findKey(raw, COLUMN_ALIASES.employeeEmail) ?? "").trim(),
    merchant: String(findKey(raw, COLUMN_ALIASES.merchant) ?? "").trim(),
    amount: typeof amountRaw === "number" ? amountRaw : Number(String(amountRaw ?? "").replace(/,/g, "")),
    currency: String(findKey(raw, COLUMN_ALIASES.currency) ?? "USD").trim() || "USD",
    category: String(findKey(raw, COLUMN_ALIASES.category) ?? "").trim(),
    expenseDate: toDateString(findKey(raw, COLUMN_ALIASES.expenseDate)),
    justification: String(findKey(raw, COLUMN_ALIASES.justification) ?? "").trim(),
  };
}

interface RowState {
  row: BulkRowInput;
  status: "pending" | "processing" | "done";
  result?: BulkRowResult;
}

type Tally = Record<ComparativeOutcome, number>;

function emptyTally(): Tally {
  return { APPROVED: 0, REVIEW_REQUIRED: 0, REJECTED: 0, ERROR: 0 };
}

/** Decisión final (reglas + Jev + pago) — la única que autoriza fondos. */
function finalOutcomeOf(r: RowState): ComparativeOutcome | undefined {
  if (r.status !== "done" || !r.result) return undefined;
  return r.result.ok ? (r.result.outcome ?? "ERROR") : "ERROR";
}

/** Lectura aislada de un motor (Jev o LLM), solo para el panel comparativo. */
function engineOutcomeOf(r: RowState, pick: (res: BulkRowResult) => EngineComparativeResult | undefined) {
  if (r.status !== "done" || !r.result) return undefined;
  if (!r.result.ok) return "ERROR" as const;
  return pick(r.result)?.outcome ?? ("ERROR" as const);
}

function tallyOf(rows: RowState[], pick: (r: RowState) => ComparativeOutcome | undefined): Tally {
  const t = emptyTally();
  for (const r of rows) {
    const outcome = pick(r);
    if (outcome) t[outcome]++;
  }
  return t;
}

const SEGMENTS: { key: ComparativeOutcome; label: string; colorClass: string }[] = [
  { key: "APPROVED", label: "Aprobado", colorClass: "bg-status-good" },
  { key: "REVIEW_REQUIRED", label: "Revisión", colorClass: "bg-status-warning" },
  { key: "REJECTED", label: "Rechazado", colorClass: "bg-status-critical" },
  { key: "ERROR", label: "Error", colorClass: "bg-status-critical" },
];

function formatCost(usd: number | undefined): string | null {
  if (usd === undefined) return null;
  if (usd === 0) return "$0";
  return usd < 0.001 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(4)}`;
}

function EngineCell({
  comparative,
  rowFailed,
}: {
  comparative?: EngineComparativeResult;
  rowFailed: boolean;
}) {
  if (rowFailed) return <span className="text-xs text-status-critical">N/A</span>;
  if (!comparative) return <span className="text-text-secondary">—</span>;
  if (comparative.error) {
    return (
      <span className="text-xs text-status-critical" title={comparative.error}>
        ⚠ error
      </span>
    );
  }
  const cost = formatCost(comparative.costUsd);
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <StatusBadge outcome={comparative.outcome} />
      {comparative.compliesWithPolicy !== undefined && comparative.requiresReview !== undefined && (
        <span className="text-[10px] text-text-secondary" title="Cumple política / requiere revisión">
          {Math.round(comparative.compliesWithPolicy * 100)}% cumple ·{" "}
          {Math.round(comparative.requiresReview * 100)}% revisión
        </span>
      )}
      {comparative.latencyMs !== undefined && (
        <span className="text-[10px] text-text-secondary">
          {comparative.latencyMs}ms{cost ? ` · ${cost}` : ""}
        </span>
      )}
    </div>
  );
}

interface EngineStats {
  count: number;
  avgLatencyMs: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
}

function statsOf(
  rows: RowState[],
  pick: (res: BulkRowResult) => EngineComparativeResult | undefined,
): EngineStats {
  let count = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costSum = 0;
  let costCount = 0;

  for (const r of rows) {
    if (r.status !== "done" || !r.result?.ok) continue;
    const c = pick(r.result);
    if (!c || c.error) continue;
    count++;
    if (c.latencyMs !== undefined) {
      latencySum += c.latencyMs;
      latencyCount++;
    }
    inputTokens += c.inputTokens ?? 0;
    outputTokens += c.outputTokens ?? 0;
    if (c.costUsd !== undefined) {
      costSum += c.costUsd;
      costCount++;
    }
  }

  return {
    count,
    avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUsd: costCount ? costSum : null,
  };
}

/** mm:ss.d — reloj compartido de la carrera Jev vs LLM. */
function formatClock(ms: number): string {
  const deci = Math.floor(ms / 100) % 10;
  const totalSeconds = Math.floor(ms / 1000);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${deci}`;
}

const OUTCOME_BG_CLASS: Record<ComparativeOutcome, string> = {
  APPROVED: "bg-status-good",
  REVIEW_REQUIRED: "bg-status-warning",
  REJECTED: "bg-status-critical",
  ERROR: "bg-status-critical",
};

const OUTCOME_TINT_CLASS: Record<ComparativeOutcome, string> = {
  APPROVED: "bg-status-good/15",
  REVIEW_REQUIRED: "bg-status-warning/15",
  REJECTED: "bg-status-critical/15",
  ERROR: "bg-status-critical/15",
};

const OUTCOME_LABEL: Record<ComparativeOutcome, string> = {
  APPROVED: "APROBADO",
  REVIEW_REQUIRED: "REVISIÓN",
  REJECTED: "RECHAZADO",
  ERROR: "ERROR",
};

interface RaceLogRow {
  index: number;
  merchant: string;
  outcome: ComparativeOutcome;
  compliesWithPolicy?: number;
}

/**
 * Panel estilo terminal para un motor (Jev o LLM genérico): log de las
 * últimas filas resueltas, grid de puntos que se llena fila por fila (mismo
 * total que la hoja cargada), y el conteo grande "analizados / total".
 * Estilo inspirado en la referencia "mismo reloj" de TypeSafe, pero con nuestra
 * propia paleta (accent/status) en vez del halftone rosa/negro original.
 */
function EngineRacePanel({
  label,
  markerClass,
  rows,
  pick,
  tally,
  total,
  stats,
}: {
  label: string;
  markerClass: string;
  rows: RowState[];
  pick: (res: BulkRowResult) => EngineComparativeResult | undefined;
  tally: Tally;
  total: number;
  stats: EngineStats;
}) {
  const recent: RaceLogRow[] = [];
  for (let i = rows.length - 1; i >= 0 && recent.length < 5; i--) {
    const r = rows[i];
    const outcome = engineOutcomeOf(r, pick);
    if (!outcome) continue;
    const c = r.result?.ok ? pick(r.result) : undefined;
    recent.push({ index: i + 1, merchant: r.row.merchant || "—", outcome, compliesWithPolicy: c?.compliesWithPolicy });
  }

  const analyzed = tally.APPROVED + tally.REVIEW_REQUIRED + tally.REJECTED + tally.ERROR;
  const totalCostFormatted = formatCost(stats.totalCostUsd ?? undefined);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-card p-2 font-mono">
      <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground">
          <span className={`inline-block h-2 w-2 ${markerClass}`} aria-hidden />
          {label}
        </div>
        <div className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 border border-border-subtle" />
          <span className="h-2 w-2 border border-border-subtle" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 rounded bg-surface-muted p-1.5 text-[11px]">
        {recent.length === 0 && <span className="text-text-secondary">esperando…</span>}
        {recent.map((r, idx) => (
          <div
            key={r.index}
            className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 ${idx === 0 ? OUTCOME_TINT_CLASS[r.outcome] : ""}`}
          >
            <span className="truncate text-text-secondary">
              #{String(r.index).padStart(3, "0")} {r.merchant}
            </span>
            <span className={idx === 0 ? "font-semibold text-foreground" : "text-text-secondary"}>
              {OUTCOME_LABEL[r.outcome]}
              {r.compliesWithPolicy !== undefined ? ` ${Math.round(r.compliesWithPolicy * 100)}%` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-[2px]">
        {rows.map((r, i) => {
          const outcome = engineOutcomeOf(r, pick);
          return (
            <span
              key={i}
              className={`h-[6px] w-[6px] rounded-[1px] ${
                outcome ? OUTCOME_BG_CLASS[outcome] : "border border-border-subtle bg-surface-muted"
              }`}
              title={outcome ? `#${i + 1} ${r.row.merchant}: ${OUTCOME_LABEL[outcome]}` : `#${i + 1} pendiente`}
            />
          );
        })}
      </div>

      <p className="text-[10px] text-text-secondary">
        {stats.avgLatencyMs !== null ? `${stats.avgLatencyMs}ms prom.` : "—"} ·{" "}
        {stats.totalInputTokens + stats.totalOutputTokens} tokens · {totalCostFormatted ?? "sin precio"}
      </p>

      <div>
        <p className="text-[10px] tracking-wide text-text-secondary">ANALIZADOS</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {analyzed} <span className="text-sm font-normal text-text-secondary">/ {total}</span>
        </p>
      </div>
    </div>
  );
}

export function BulkUpload({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  async function handleFile(file: File) {
    setFileError(null);
    setRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (raw.length === 0) {
        setFileError("El archivo no tiene filas de datos.");
        return;
      }
      if (raw.length > MAX_ROWS) {
        setFileError(
          `El archivo tiene ${raw.length} filas; el límite para la demo en vivo es ${MAX_ROWS}. Usa un archivo más pequeño.`,
        );
        return;
      }

      const parsed = raw.map((r) => parseRow(r));
      setRows(parsed.map((row) => ({ row, status: "pending" as const })));
    } catch (err) {
      setFileError(
        `No se pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function runSimulation() {
    setRunning(true);
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => {
      if (startTimeRef.current !== null) setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
    try {
      for (let i = 0; i < rows.length; i++) {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "processing" } : r)),
        );
        const result = await processBulkExpenseRow(companyId, rows[i].row);
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", result } : r)),
        );
      }
    } finally {
      window.clearInterval(timer);
      if (startTimeRef.current !== null) setElapsedMs(Date.now() - startTimeRef.current);
      setRunning(false);
    }
    router.refresh();
  }

  const finalTally = useMemo(() => tallyOf(rows, finalOutcomeOf), [rows]);
  const jevTally = useMemo(() => tallyOf(rows, (r) => engineOutcomeOf(r, (res) => res.jev)), [rows]);
  const llmTally = useMemo(() => tallyOf(rows, (r) => engineOutcomeOf(r, (res) => res.shadow)), [rows]);
  const jevStats = useMemo(() => statsOf(rows, (res) => res.jev), [rows]);
  const llmStats = useMemo(() => statsOf(rows, (res) => res.shadow), [rows]);
  const done = rows.filter((r) => r.status === "done").length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-muted p-4">
      <div>
        <p className="text-sm font-semibold">Carga masiva (Excel) — simulación en vivo</p>
        <p className="text-xs text-text-secondary">
          Columnas esperadas: <code>empleado</code> (email registrado), <code>comercio</code>,{" "}
          <code>monto</code>, <code>moneda</code>, <code>categoria</code>, <code>fecha</code> (YYYY-MM-DD),{" "}
          <code>justificacion</code>. Cada fila corre el pipeline completo (reglas → Jev + LLM en
          paralelo → decisión → pago) una por una, hasta {MAX_ROWS} filas.
        </p>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        disabled={running}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
        className="text-sm"
      />
      {fileError && <p className="text-sm text-status-critical">{fileError}</p>}

      {rows.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => void runSimulation()}
            disabled={running}
            className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {running
              ? `Procesando ${done}/${rows.length}…`
              : done === rows.length
                ? "Procesar de nuevo"
                : `Procesar ${rows.length} filas`}
          </button>

          {(running || done > 0) && (
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-muted p-3">
              <p className="font-mono text-[10px] tracking-wide text-text-secondary">
                SIMULACIÓN EN VIVO · MISMO RELOJ PARA AMBOS MOTORES
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle pb-2 font-mono text-[11px]">
                <span className="font-semibold text-foreground">DECISIÓN FINAL:</span>
                {SEGMENTS.filter((s) => finalTally[s.key] > 0).map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1 text-text-secondary">
                    <span className={`inline-block h-2 w-2 rounded-[1px] ${s.colorClass}`} aria-hidden />
                    {s.label}: <strong className="text-foreground">{finalTally[s.key]}</strong>
                  </span>
                ))}
                {done === 0 && <span className="text-text-secondary">pendiente</span>}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <EngineRacePanel
                  label="JEV.SYSTEM_ONE"
                  markerClass="bg-accent"
                  rows={rows}
                  pick={(res) => res.jev}
                  tally={jevTally}
                  total={rows.length}
                  stats={jevStats}
                />
                <EngineRacePanel
                  label="LLM.GENERICO"
                  markerClass="bg-text-secondary"
                  rows={rows}
                  pick={(res) => res.shadow}
                  tally={llmTally}
                  total={rows.length}
                  stats={llmStats}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle pt-2 font-mono">
                <span className="text-[10px] tracking-wide text-text-secondary">RELOJ</span>
                <span className="text-2xl font-bold tabular-nums text-accent">{formatClock(elapsedMs)}</span>
                <span className="text-[10px] tracking-wide text-text-secondary">
                  {running ? "EN CURSO" : done === rows.length && rows.length > 0 ? "COMPLETADO" : "LISTO"}
                </span>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-auto rounded-lg border border-border-subtle bg-surface-card">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="sticky top-0 bg-surface-muted">
                <tr className="border-b border-border-subtle text-text-secondary">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Empleado</th>
                  <th className="px-2 py-1.5">Comercio</th>
                  <th className="px-2 py-1.5">Monto</th>
                  <th className="px-2 py-1.5">Análisis Jev</th>
                  <th className="px-2 py-1.5">Análisis LLM</th>
                  <th className="px-2 py-1.5">Decisión final</th>
                  <th className="px-2 py-1.5">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const rowFailed = r.status === "done" && r.result !== undefined && !r.result.ok;
                  return (
                    <tr key={i} className="border-b border-border-subtle last:border-0 align-top">
                      <td className="px-2 py-1.5 text-text-secondary">{i + 1}</td>
                      <td className="px-2 py-1.5">{r.row.employeeEmail}</td>
                      <td className="px-2 py-1.5">{r.row.merchant}</td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {r.row.amount} {r.row.currency}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.status === "pending" && <span className="text-text-secondary">—</span>}
                        {r.status === "processing" && <span className="text-accent">…</span>}
                        {r.status === "done" && (
                          <EngineCell comparative={r.result?.jev} rowFailed={rowFailed} />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.status === "pending" && <span className="text-text-secondary">—</span>}
                        {r.status === "processing" && <span className="text-accent">…</span>}
                        {r.status === "done" && (
                          <EngineCell comparative={r.result?.shadow} rowFailed={rowFailed} />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.status === "pending" && <span className="text-text-secondary">pendiente</span>}
                        {r.status === "processing" && <span className="text-accent">procesando…</span>}
                        {r.status === "done" && r.result?.ok && r.result.outcome && (
                          <StatusBadge outcome={r.result.outcome} />
                        )}
                        {r.status === "done" && !r.result?.ok && (
                          <StatusBadge outcome="ERROR" />
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-text-secondary">
                        {r.result?.error ?? r.result?.reason ?? ""}
                        {r.result?.paymentTxHash && " · pagado"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
