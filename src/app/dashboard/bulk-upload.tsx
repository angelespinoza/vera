"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { processBulkExpenseRow, type BulkRowInput, type BulkRowResult } from "@/app/actions/bulk";
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

export function BulkUpload({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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
    for (let i = 0; i < rows.length; i++) {
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "processing" } : r)),
      );
      const result = await processBulkExpenseRow(companyId, rows[i].row);
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "done", result } : r)),
      );
    }
    setRunning(false);
    router.refresh();
  }

  const done = rows.filter((r) => r.status === "done");
  const approved = done.filter((r) => r.result?.outcome === "APPROVED").length;
  const rejected = done.filter((r) => r.result?.outcome === "REJECTED").length;
  const review = done.filter((r) => r.result?.outcome === "REVIEW_REQUIRED").length;
  const errors = done.filter((r) => !r.result?.ok).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-muted p-4">
      <div>
        <p className="text-sm font-semibold">Carga masiva (Excel) — simulación en vivo</p>
        <p className="text-xs text-text-secondary">
          Columnas esperadas: <code>empleado</code> (email registrado), <code>comercio</code>,{" "}
          <code>monto</code>, <code>moneda</code>, <code>categoria</code>, <code>fecha</code> (YYYY-MM-DD),{" "}
          <code>justificacion</code>. Cada fila corre el pipeline completo (reglas → Jev → decisión →
          pago) una por una, hasta {MAX_ROWS} filas.
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runSimulation()}
              disabled={running}
              className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {running
                ? `Procesando ${done.length}/${rows.length}…`
                : done.length === rows.length
                  ? "Procesar de nuevo"
                  : `Procesar ${rows.length} filas`}
            </button>
            {done.length > 0 && (
              <p className="text-xs text-text-secondary">
                Aprobados: <strong className="text-status-good">{approved}</strong> · Rechazados:{" "}
                <strong className="text-status-critical">{rejected}</strong> · Revisión:{" "}
                <strong className="text-status-warning">{review}</strong>
                {errors > 0 && (
                  <>
                    {" "}
                    · Errores: <strong className="text-status-critical">{errors}</strong>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-border-subtle bg-surface-card">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-muted">
                <tr className="border-b border-border-subtle text-text-secondary">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Empleado</th>
                  <th className="px-2 py-1.5">Comercio</th>
                  <th className="px-2 py-1.5">Monto</th>
                  <th className="px-2 py-1.5">Estado</th>
                  <th className="px-2 py-1.5">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="px-2 py-1.5 text-text-secondary">{i + 1}</td>
                    <td className="px-2 py-1.5">{r.row.employeeEmail}</td>
                    <td className="px-2 py-1.5">{r.row.merchant}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {r.row.amount} {r.row.currency}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.status === "pending" && <span className="text-text-secondary">pendiente</span>}
                      {r.status === "processing" && (
                        <span className="text-accent">procesando…</span>
                      )}
                      {r.status === "done" && r.result?.ok && r.result.outcome && (
                        <StatusBadge outcome={r.result.outcome} />
                      )}
                      {r.status === "done" && !r.result?.ok && (
                        <span className="font-bold text-status-critical">✕ ERROR</span>
                      )}
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
