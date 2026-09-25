import { getCompany, EVALUATED_STATUSES } from "../data";
import { stellarExpertTxUrl } from "@/lib/stellar";
import { Card, StatusBadge } from "../ui";
import { ComplianceRing } from "../charts";
import { ExpandableRow } from "../expandable-row";
import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "@/lib/decision/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

export const dynamic = "force-dynamic";

const OUTCOME_RING_COLOR: Record<string, string> = {
  APPROVED: "var(--status-good)",
  REJECTED: "var(--status-critical)",
  REVIEW_REQUIRED: "var(--status-warning)",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "ALL";
  const employeeFilter = typeof params.employeeId === "string" ? params.employeeId : "ALL";
  const categoryFilter = typeof params.category === "string" ? params.category : "ALL";

  const company = await getCompany();
  if (!company) return null;

  const evaluated = company.expenses.filter((e) => EVALUATED_STATUSES.includes(e.status));
  const categories = Array.from(new Set(evaluated.map((e) => e.category).filter(Boolean))) as string[];
  const filteredEvaluated = evaluated.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (employeeFilter !== "ALL" && e.employeeId !== employeeFilter) return false;
    if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <Card title="Historial" badge={<span className="text-xs text-text-secondary">{evaluated.length} gastos evaluados</span>}>
      {evaluated.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Aún no hay gastos evaluados. Analiza uno en{" "}
          <a href="/dashboard/expenses" className="underline">
            Gastos
          </a>
          .
        </p>
      ) : (
        <>
          <form
            method="get"
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border-subtle bg-surface-muted p-3 text-sm"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="text-xs text-text-secondary">
                Estado
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-sm"
              >
                <option value="ALL">Todos</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
                <option value="REVIEW_REQUIRED">Requiere revisión</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="employeeId" className="text-xs text-text-secondary">
                Empleado
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={employeeFilter}
                className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-sm"
              >
                <option value="ALL">Todos</option>
                {company.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="category" className="text-xs text-text-secondary">
                Categoría
              </label>
              <select
                id="category"
                name="category"
                defaultValue={categoryFilter}
                className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-sm"
              >
                <option value="ALL">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
              Filtrar
            </button>
            {(statusFilter !== "ALL" || employeeFilter !== "ALL" || categoryFilter !== "ALL") && (
              <a href="/dashboard/historial" className="text-xs underline">
                Limpiar filtros
              </a>
            )}
          </form>

          {filteredEvaluated.length === 0 ? (
            <p className="text-sm text-text-secondary">Ningún gasto coincide con estos filtros.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-muted text-xs text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Empleado</th>
                    <th className="px-3 py-2 font-medium">Comercio</th>
                    <th className="px-3 py-2 font-medium">Monto</th>
                    <th className="px-3 py-2 font-medium">Categoría</th>
                    <th className="px-3 py-2 font-medium">Cumplimiento</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluated.map((expense) => {
                    const evaluation = expense.ruleResults as unknown as RuleEvaluationResult | null;
                    const jev = expense.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
                    const shadow = expense.shadowResults as unknown as
                      | (ShadowEvaluationResult & { error?: string })
                      | null;
                    const decision = expense.decision as unknown as DecisionResult | null;
                    const ringColor = decision
                      ? (OUTCOME_RING_COLOR[decision.outcome] ?? "var(--text-secondary)")
                      : "var(--text-secondary)";

                    const detail = (
                      <div className="flex flex-col gap-3">
                        <p className="text-text-secondary">{expense.justification}</p>
                        {decision && <p className="text-text-secondary">{decision.reason}</p>}
                        {expense.paymentTxHash && (
                          <p className="text-status-good">
                            Pagado —{" "}
                            <a
                              href={stellarExpertTxUrl(expense.paymentTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ver transacción
                            </a>
                          </p>
                        )}
                        {expense.paymentError && (
                          <p className="text-status-critical">Aprobado pero el pago falló: {expense.paymentError}</p>
                        )}
                        {evaluation && (
                          <div className="flex flex-col gap-0.5">
                            <p className="font-medium text-text-secondary">
                              Reglas determinísticas:{" "}
                              {evaluation.allPassed ? (
                                <span className="text-status-good">todas pasaron</span>
                              ) : (
                                <span className="text-status-critical">hay reglas que fallaron</span>
                              )}
                            </p>
                            <ul>
                              {evaluation.checks.map((check) => (
                                <li key={check.rule}>
                                  {check.passed ? "✓" : "✗"} {check.label} — {check.detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(jev || shadow) && (
                          <div className="flex flex-col gap-2">
                            <div>
                              <p className="font-medium text-text-secondary">
                                Jev (oficial) —{" "}
                                {jev?.error
                                  ? "error"
                                  : jev
                                    ? `${jev.model}, ${jev.latencyMs}ms`
                                    : "sin datos (gasto evaluado antes de esta función)"}
                              </p>
                              {jev && !jev.error ? (
                                <ul>
                                  <li>Cumple política: {Math.round(jev.compliesWithPolicy.probability * 100)}%</li>
                                  <li>Propósito válido: {Math.round(jev.businessPurposeValid.probability * 100)}%</li>
                                  <li>
                                    Evidencia suficiente: {Math.round(jev.evidenceSufficient.probability * 100)}%
                                  </li>
                                  <li>Requiere revisión: {Math.round(jev.requiresReview.probability * 100)}%</li>
                                  {jev.roleRelevant && (
                                    <li>Relevante al rol: {Math.round(jev.roleRelevant.probability * 100)}%</li>
                                  )}
                                </ul>
                              ) : (
                                jev?.error && <p className="text-status-critical">{jev.error}</p>
                              )}
                            </div>
                            {shadow && !shadow.error && (
                              <p className="border-l-2 border-border-subtle pl-2 text-text-secondary">
                                ↳ LLM genérico ({shadow.provider}/{shadow.model}, {shadow.latencyMs}ms,{" "}
                                {Math.round(shadow.compliesWithPolicy * 100)}% cumple) —{" "}
                                {decision && shadow.outcome === decision.outcome ? (
                                  "coincide con la decisión real. Solo informativo."
                                ) : (
                                  <>
                                    habría dicho <strong>{shadow.outcome}</strong> — difiere de la decisión real. Solo
                                    informativo, nunca autoriza el pago.
                                  </>
                                )}
                              </p>
                            )}
                            {shadow?.error && (
                              <p className="border-l-2 border-border-subtle pl-2 text-status-critical">
                                LLM genérico: error — {shadow.error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <ExpandableRow
                        key={expense.id}
                        colSpan={6}
                        summary={
                          <>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text-secondary">
                                  {initialsOf(expense.employee.name)}
                                </span>
                                {expense.employee.name}
                              </div>
                            </td>
                            <td className="px-3 py-2">{expense.merchant}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {expense.amount} {expense.currency}
                            </td>
                            <td className="px-3 py-2 text-text-secondary">{expense.category}</td>
                            <td className="px-3 py-2">
                              {jev && !jev.error ? (
                                <ComplianceRing fraction={jev.compliesWithPolicy.probability} colorVar={ringColor} />
                              ) : (
                                <span className="text-text-secondary">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{decision && <StatusBadge outcome={decision.outcome} />}</td>
                          </>
                        }
                        detail={detail}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
