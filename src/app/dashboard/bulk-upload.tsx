"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { processBulkExpenseRow, type BulkRowInput, type BulkRowResult } from "@/app/actions/bulk";
import type { ComparativeOutcome, EngineComparativeResult } from "@/lib/expense/pipeline";
import { StatTile, StatusBadge } from "./ui";

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

/**
 * Columna única de decisión: el badge grande es SIEMPRE la decisión real
 * (reglas + Jev + pago) — la única que mueve dinero. La lectura de Jev se
 * pliega como detalle secundario junto al badge (es lo que la alimentó). El
 * LLM genérico solo aparece como nota al pie, indentada y en texto plano, y
 * únicamente cuando su veredicto difiere del real — nunca como un badge
 * propio, para no dar la impresión de "dos jueces en desacuerdo" cuando en
 * realidad solo uno decide (ver conversación sobre Jev vs. LLM).
 */
function DecisionCell({ result, status }: { result?: BulkRowResult; status: RowState["status"] }) {
  if (status === "pending") return <span className="text-text-secondary">pendiente</span>;
  if (status === "processing") return <span className="text-accent">procesando…</span>;
  if (!result) return null;

  const finalOutcome: ComparativeOutcome = result.ok ? (result.outcome ?? "ERROR") : "ERROR";
  const jev = result.jev;
  const shadow = result.shadow;
  const shadowDiffers = result.ok && shadow && !shadow.error && shadow.outcome !== finalOutcome;

  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <div className="flex items-center gap-1.5">
        <StatusBadge outcome={finalOutcome} />
        {result.ok && jev && !jev.error && jev.compliesWithPolicy !== undefined && (
          <span className="text-[10px] text-text-secondary">({Math.round(jev.compliesWithPolicy * 100)}% Jev)</span>
        )}
      </div>
      {shadowDiffers && shadow && (
        <p className="pl-3 text-[10px] text-text-secondary">
          ↳ el LLM comparativo habría dicho {OUTCOME_LABEL[shadow.outcome]}
          {shadow.compliesWithPolicy !== undefined ? ` (${Math.round(shadow.compliesWithPolicy * 100)}%)` : ""} — solo
          informativo
        </p>
      )}
    </div>
  );
}

const OUTCOME_BG_CLASS: Record<ComparativeOutcome, string> = {
  APPROVED: "bg-status-good",
  REVIEW_REQUIRED: "bg-status-warning",
  REJECTED: "bg-status-critical",
  ERROR: "bg-status-critical",
};

const OUTCOME_LABEL: Record<ComparativeOutcome, string> = {
  APPROVED: "APROBADO",
  REVIEW_REQUIRED: "REVISIÓN",
  REJECTED: "RECHAZADO",
  ERROR: "ERROR",
};

const OUTCOME_TEXT_CLASS: Record<ComparativeOutcome, string> = {
  APPROVED: "text-status-good",
  REVIEW_REQUIRED: "text-status-warning",
  REJECTED: "text-status-critical",
  ERROR: "text-status-critical",
};

const OUTCOME_ICON: Record<ComparativeOutcome, string> = {
  APPROVED: "✓",
  REVIEW_REQUIRED: "!",
  REJECTED: "✗",
  ERROR: "✗",
};

function merchantInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Grid de "logos" (iniciales del comercio) que se van resaltando fila por
 * fila conforme Jev las analiza — inspirado en la demo de TypeSafe/Firecrawl
 * (grid de empresas Fortune 1000), adaptado a nuestros propios comercios y
 * paleta de estado.
 */
function MerchantGrid({
  rows,
  pick,
}: {
  rows: RowState[];
  pick: (res: BulkRowResult) => EngineComparativeResult | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {rows.map((r, i) => {
        const outcome = engineOutcomeOf(r, pick);
        const processing = r.status === "processing";
        return (
          <span
            key={i}
            className={`flex h-6 w-6 items-center justify-center rounded-[4px] text-[9px] font-semibold transition-colors duration-300 ${
              outcome
                ? `${OUTCOME_BG_CLASS[outcome]} text-white`
                : processing
                  ? "border-2 border-accent text-accent"
                  : "border border-border-subtle bg-surface-muted text-text-secondary"
            }`}
            title={`#${i + 1} ${r.row.merchant}${outcome ? `: ${OUTCOME_LABEL[outcome]}` : ""}`}
          >
            {merchantInitials(r.row.merchant || "—")}
          </span>
        );
      })}
    </div>
  );
}

/** Una fila de criterio de Jev, como barra horizontal (etiqueta + barra + valor). */
function JevBar({ label, value }: { label: string; value: number | undefined }) {
  const pct = value !== undefined ? Math.round(value * 100) : null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-xs text-foreground">{label}</p>
        <p className="font-mono text-[10px] text-text-secondary">noul</p>
      </div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: pct !== null ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-secondary">
        {pct !== null ? (pct / 100).toFixed(2) : "—"}
      </span>
    </div>
  );
}

/** Ficha con el detalle completo de Jev para el último gasto resuelto, en vivo. */
function LiveAnalysisCard({ row }: { row: RowState | undefined }) {
  const jev = row?.result?.ok ? row.result.jev : undefined;
  if (!row || !jev || jev.error) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-card p-3">
        <p className="text-xs font-semibold text-text-secondary">Jev · Análisis en vivo</p>
        <p className="text-sm text-text-secondary">Esperando a Jev…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-secondary">Jev · Análisis en vivo</p>
        {jev.latencyMs !== undefined && (
          <span className="text-[10px] text-text-secondary">respondido en {jev.latencyMs}ms</span>
        )}
      </div>
      <div>
        <p className="font-medium text-foreground">{row.row.merchant}</p>
        <p className="text-xs text-text-secondary">
          {row.row.category} · {row.row.amount} {row.row.currency} · {row.row.employeeEmail}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <JevBar label="Cumple política" value={jev.compliesWithPolicy} />
        <JevBar label="Propósito válido" value={jev.businessPurposeValid} />
        <JevBar label="Evidencia suficiente" value={jev.evidenceSufficient} />
        <JevBar label="Requiere revisión" value={jev.requiresReview} />
        {jev.roleRelevant !== undefined && <JevBar label="Relevante al rol" value={jev.roleRelevant} />}
      </div>
    </div>
  );
}

function categoryTallyOf(rows: RowState[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "done") continue;
    const cat = r.row.category || "—";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

/** Barras agregadas: por categoría del gasto y por veredicto de Jev. */
function VerdictsPanel({ rows, tally }: { rows: RowState[]; tally: Tally }) {
  const categories = categoryTallyOf(rows);
  const maxCategoryCount = Math.max(1, ...categories.map(([, n]) => n));
  const analyzed = tally.APPROVED + tally.REVIEW_REQUIRED + tally.REJECTED + tally.ERROR;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-3 sm:flex-row sm:gap-6">
      <div className="flex-1">
        <p className="mb-2 text-xs font-semibold text-text-secondary">Por categoría</p>
        <div className="flex flex-col gap-1.5">
          {categories.length === 0 && <span className="text-xs text-text-secondary">—</span>}
          {categories.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-text-secondary">{cat}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <p className="mb-2 text-xs font-semibold text-text-secondary">Veredicto de Jev ({analyzed})</p>
        <div className="flex flex-col gap-1.5">
          {SEGMENTS.filter((s) => tally[s.key] > 0).map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-text-secondary">{s.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${s.colorClass} transition-all duration-500`}
                  style={{ width: `${(tally[s.key] / Math.max(1, analyzed)) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-foreground">{tally[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Feed tipo terminal con las últimas filas resueltas por Jev. */
function TerminalFeed({
  rows,
  pick,
  totalRows,
}: {
  rows: RowState[];
  pick: (res: BulkRowResult) => EngineComparativeResult | undefined;
  totalRows: number;
}) {
  const lines: { merchant: string; category: string; outcome: ComparativeOutcome; pct: string; ms: string }[] = [];
  for (let i = rows.length - 1; i >= 0 && lines.length < 8; i--) {
    const r = rows[i];
    const outcome = engineOutcomeOf(r, pick);
    if (!outcome) continue;
    const c = r.result?.ok ? pick(r.result) : undefined;
    lines.push({
      merchant: r.row.merchant || "—",
      category: r.row.category || "—",
      outcome,
      pct: c?.compliesWithPolicy !== undefined ? `${Math.round(c.compliesWithPolicy * 100)}%` : "—",
      ms: c?.latencyMs !== undefined ? `${c.latencyMs}ms` : "—",
    });
  }

  return (
    <div className="overflow-hidden rounded-lg bg-neutral-900 font-mono text-[11px]">
      <div className="flex items-center gap-1.5 border-b border-neutral-700 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-neutral-600" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-neutral-600" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-neutral-600" aria-hidden />
        <span className="ml-2 text-neutral-500">jev · análisis en vivo</span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-neutral-500">$ jev analyze ./carga-masiva.xlsx --questions 4 --parallel {totalRows}</p>
        {lines.length === 0 && <p className="text-neutral-600">esperando resultados…</p>}
        {lines.map((line, idx) => (
          <p key={idx} className={idx === 0 ? "text-neutral-100" : "text-neutral-400"}>
            <span className={OUTCOME_TEXT_CLASS[line.outcome]}>{OUTCOME_ICON[line.outcome]}</span>{" "}
            {line.merchant.padEnd(20).slice(0, 20)} {line.category.padEnd(13).slice(0, 13)}{" "}
            <span className={OUTCOME_TEXT_CLASS[line.outcome]}>{OUTCOME_LABEL[line.outcome].padEnd(10)}</span>{" "}
            {line.pct.padStart(4)} {line.ms}
          </p>
        ))}
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
  const done = rows.filter((r) => r.status === "done").length;

  const jevAnalyzed = jevTally.APPROVED + jevTally.REVIEW_REQUIRED + jevTally.REJECTED + jevTally.ERROR;
  const flaggedByJev = jevTally.REVIEW_REQUIRED + jevTally.REJECTED + jevTally.ERROR;
  const typedAnswers = rows.reduce((acc, r) => {
    const jev = r.result?.ok ? r.result.jev : undefined;
    if (!jev || jev.error) return acc;
    return acc + 4 + (jev.roleRelevant !== undefined ? 1 : 0);
  }, 0);
  const elapsedSeconds = elapsedMs / 1000;
  const answersPerSec = elapsedSeconds > 0 ? Math.round(typedAnswers / elapsedSeconds) : 0;
  // Prioriza la última fila con lectura válida de Jev (si la última en
  // terminar fue un error, ej. empleado inexistente, no tiene sentido
  // mostrarla como "esperando a Jev" cuando ya hay lecturas previas).
  const reversedDone = [...rows].reverse().filter((r) => r.status === "done");
  const lastDoneRow =
    reversedDone.find((r) => r.result?.ok && r.result.jev && !r.result.jev.error) ?? reversedDone[0];

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
            <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-4">
              <div>
                <p className="text-2xl font-semibold text-foreground sm:text-3xl">
                  Jev analizó {jevAnalyzed} gasto{jevAnalyzed === 1 ? "" : "s"}{" "}
                  <span className="text-text-secondary">en</span>{" "}
                  <span className="text-accent">{elapsedSeconds.toFixed(2)}s</span>
                  {running ? "…" : "."}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                  <span className="font-medium text-foreground">Decisión final (reglas + Jev + pago):</span>
                  {SEGMENTS.filter((s) => finalTally[s.key] > 0).map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1">
                      <span className={`inline-block h-2 w-2 rounded-[1px] ${s.colorClass}`} aria-hidden />
                      {s.label}: <strong className="text-foreground">{finalTally[s.key]}</strong>
                    </span>
                  ))}
                  {done === 0 && <span>pendiente</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Respuestas tipadas" value={String(typedAnswers)} hint="4-5 por gasto" />
                <StatTile label="Respuestas / seg" value={String(answersPerSec)} hint={running ? "en vivo" : "final"} />
                <StatTile label="Filas del Excel" value={`${jevAnalyzed}/${rows.length}`} hint="analizadas" />
                <StatTile label="Marcadas por Jev" value={String(flaggedByJev)} hint="revisión o rechazo" />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">Gastos cargados ({rows.length})</p>
                <MerchantGrid rows={rows} pick={(res) => res.jev} />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <LiveAnalysisCard row={lastDoneRow} />
                <VerdictsPanel rows={rows} tally={jevTally} />
              </div>

              <TerminalFeed rows={rows} pick={(res) => res.jev} totalRows={rows.length} />
            </div>
          )}

          <div className="max-h-96 overflow-auto rounded-lg border border-border-subtle bg-surface-card">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="sticky top-0 bg-surface-muted">
                <tr className="border-b border-border-subtle text-text-secondary">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Empleado</th>
                  <th className="px-2 py-1.5">Comercio</th>
                  <th className="px-2 py-1.5">Monto</th>
                  <th className="px-2 py-1.5">Decisión final</th>
                  <th className="px-2 py-1.5">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0 align-top">
                    <td className="px-2 py-1.5 text-text-secondary">{i + 1}</td>
                    <td className="px-2 py-1.5">{r.row.employeeEmail}</td>
                    <td className="px-2 py-1.5">{r.row.merchant}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {r.row.amount} {r.row.currency}
                    </td>
                    <td className="px-2 py-1.5">
                      <DecisionCell result={r.result} status={r.status} />
                    </td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {r.result?.error ?? r.result?.reason ?? ""}
                      {r.result?.paymentTxHash && " · pagado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
