import { getCompany, EVALUATED_STATUSES } from "../data";
import { stellarExpertTxUrl } from "@/lib/stellar";
import { Card, StatusBadge, CountBadge } from "../ui";
import { ExpenseUploadForm } from "../expense-upload-form";
import { ExpenseConfirmForm } from "../expense-confirm-form";
import { BulkUpload } from "../bulk-upload";
import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "@/lib/decision/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
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

  const pending = company.expenses.filter((e) => e.status === "EXTRACTED");
  const evaluated = company.expenses.filter((e) => EVALUATED_STATUSES.includes(e.status));

  const categories = Array.from(new Set(evaluated.map((e) => e.category).filter(Boolean))) as string[];
  const filteredEvaluated = evaluated.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (employeeFilter !== "ALL" && e.employeeId !== employeeFilter) return false;
    if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <Card title="Gastos" badge={<CountBadge count={pending.length} />}>
      <ExpenseUploadForm
        companyId={company.id}
        employees={company.employees.map((e) => ({ id: e.id, name: e.name }))}
      />

      <BulkUpload companyId={company.id} />

      {pending.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-status-warning/40 bg-status-warning/5 p-3">
          <h3 className="text-sm font-semibold text-status-warning">
            ! Pendientes de confirmación — acción requerida
          </h3>
          {pending.map((expense) => {
            const extracted = expense.extractedData as { confidence?: number } | null;
            return (
              <ExpenseConfirmForm
                key={expense.id}
                expenseId={expense.id}
                employeeName={expense.employee.name}
                receiptDataUrl={`data:${expense.receiptMimeType};base64,${Buffer.from(expense.receiptFile!).toString("base64")}`}
                amount={expense.amount}
                currency={expense.currency}
                merchant={expense.merchant}
                expenseDate={expense.expenseDate?.toISOString().slice(0, 10)}
                category={expense.category}
                confidence={extracted?.confidence}
              />
            );
          })}
        </div>
      )}

      {evaluated.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-text-secondary">Historial</h3>

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
              <a href="/dashboard/expenses" className="text-xs underline">
                Limpiar filtros
              </a>
            )}
          </form>

          {filteredEvaluated.length === 0 ? (
            <p className="text-sm text-text-secondary">Ningún gasto coincide con estos filtros.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredEvaluated.map((expense) => {
                const evaluation = expense.ruleResults as unknown as RuleEvaluationResult | null;
                const jev = expense.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
                const shadow = expense.shadowResults as unknown as
                  | (ShadowEvaluationResult & { error?: string })
                  | null;
                const decision = expense.decision as unknown as DecisionResult | null;
                return (
                  <li
                    key={expense.id}
                    className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-card p-3 text-sm"
                  >
                    {decision && <StatusBadge outcome={decision.outcome} />}
                    <p>
                      <span className="font-medium">{expense.employee.name}</span> — {expense.merchant} —{" "}
                      <span className="tabular-nums">
                        {expense.amount} {expense.currency}
                      </span>{" "}
                      — <span className="text-text-secondary">{expense.category}</span>
                    </p>
                    <p className="text-text-secondary">{expense.justification}</p>
                    {decision && <p className="text-xs text-text-secondary">{decision.reason}</p>}
                    {expense.paymentTxHash && (
                      <p className="text-xs text-status-good">
                        Pagado —{" "}
                        <a
                          href={stellarExpertTxUrl(expense.paymentTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          ver transacción
                        </a>
                      </p>
                    )}
                    {expense.paymentError && (
                      <p className="text-xs text-status-critical">
                        Aprobado pero el pago falló: {expense.paymentError}
                      </p>
                    )}
                    {(evaluation || jev || shadow) && (
                      <details className="border-t border-border-subtle pt-2 text-xs">
                        <summary className="cursor-pointer font-medium text-text-secondary">
                          Ver detalle de evaluación (reglas, Jev, comparativa)
                        </summary>
                        <div className="mt-2 flex flex-col gap-3">
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
                                    <li>
                                      Propósito válido: {Math.round(jev.businessPurposeValid.probability * 100)}%
                                    </li>
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
                                      habría dicho <strong>{shadow.outcome}</strong> — difiere de la decisión real.
                                      Solo informativo, nunca autoriza el pago.
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
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
