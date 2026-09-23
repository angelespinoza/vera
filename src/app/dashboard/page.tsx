import { prisma } from "@/lib/prisma";
import { getAccountBalances, stellarExpertAccountUrl, stellarExpertTxUrl } from "@/lib/stellar";
import type { StructuredPolicy } from "@/lib/policy/types";
import { CompanyForm } from "./company-form";
import { EmployeeForm } from "./employee-form";
import { PolicyForm } from "./policy-form";
import { PolicyEditor } from "./policy-editor";
import { ExpenseUploadForm } from "./expense-upload-form";
import { ExpenseConfirmForm } from "./expense-confirm-form";
import { Card, StatTile, StatusBadge } from "./ui";
import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "@/lib/decision/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

const EVALUATED_STATUSES = ["APPROVED", "REJECTED", "REVIEW_REQUIRED"];

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "ALL";
  const employeeFilter = typeof params.employeeId === "string" ? params.employeeId : "ALL";
  const categoryFilter = typeof params.category === "string" ? params.category : "ALL";

  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      employees: { orderBy: { createdAt: "asc" } },
      policy: true,
      expenses: { orderBy: { createdAt: "desc" }, include: { employee: true } },
    },
  });

  if (!company) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Vera — CFO Agent</h1>
        <p className="text-sm text-text-secondary">
          Aún no hay una empresa registrada. Crea una para generar su treasury
          wallet en Stellar testnet.
        </p>
        <CompanyForm />
      </main>
    );
  }

  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);
  const employeeBalances = await Promise.all(
    company.employees.map((employee) => getAccountBalances(employee.walletPublicKey)),
  );

  const pending = company.expenses.filter((e) => e.status === "EXTRACTED");
  const evaluated = company.expenses.filter((e) => EVALUATED_STATUSES.includes(e.status));

  // --- Métricas para la demo (docs/CFO_Agent_Concepto_v1.md §17) ---
  const rulesOnly = evaluated.filter((e) => {
    const d = e.decision as unknown as DecisionResult | null;
    return d && !d.hardRulesPassed;
  });
  const jevDecided = evaluated.filter((e) => {
    const d = e.decision as unknown as DecisionResult | null;
    return d && d.hardRulesPassed;
  });
  const escalated = evaluated.filter((e) => e.status === "REVIEW_REQUIRED");
  const withJevLatency = evaluated.filter((e) => {
    const j = e.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
    return j && !j.error && typeof j.latencyMs === "number";
  });
  const avgJevLatency = withJevLatency.length
    ? Math.round(
        withJevLatency.reduce(
          (acc, e) => acc + (e.jevResults as unknown as JevEvaluationResult).latencyMs,
          0,
        ) / withJevLatency.length,
      )
    : null;
  const paid = evaluated.filter((e) => e.paymentTxHash);
  const usdcSettled = paid.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const pct = (n: number) => (evaluated.length ? Math.round((n / evaluated.length) * 100) : 0);

  // --- Panel comparativo Jev vs. LLM genérico (Etapa 7) ---
  const withBoth = evaluated.filter((e) => {
    const j = e.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
    const s = e.shadowResults as unknown as (ShadowEvaluationResult & { error?: string }) | null;
    return j && !j.error && s && !s.error;
  });
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const jevAvgLatencyComparative = withBoth.length
    ? avg(withBoth.map((e) => (e.jevResults as unknown as JevEvaluationResult).latencyMs))
    : null;
  const shadowAvgLatency = withBoth.length
    ? avg(withBoth.map((e) => (e.shadowResults as unknown as ShadowEvaluationResult).latencyMs))
    : null;
  const agreements = withBoth.filter((e) => {
    const decision = e.decision as unknown as DecisionResult | null;
    const shadow = e.shadowResults as unknown as ShadowEvaluationResult;
    return decision && decision.outcome === shadow.outcome;
  }).length;

  // --- Filtros sobre el historial de evaluados ---
  const categories = Array.from(new Set(evaluated.map((e) => e.category).filter(Boolean))) as string[];
  const filteredEvaluated = evaluated.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (employeeFilter !== "ALL" && e.employeeId !== employeeFilter) return false;
    if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-1 border-b border-border-subtle pb-4">
        <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">
          Vera — CFO Agent
        </p>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-text-secondary">CFO: {company.cfoEmail}</p>
      </header>

      <Card title="Treasury (Stellar testnet)">
        <p className="break-all font-mono text-xs text-text-secondary">{company.treasuryPublicKey}</p>
        <div className="flex gap-6 text-sm">
          <span>
            XLM: <strong className="tabular-nums">{treasuryBalances.xlm}</strong>
          </span>
          <span>
            USDC: <strong className="tabular-nums">{treasuryBalances.usdc}</strong>
          </span>
        </div>
        <a
          href={stellarExpertAccountUrl(company.treasuryPublicKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm underline"
        >
          Ver en Stellar Expert
        </a>
        <p className="text-xs text-text-secondary">
          Para fondear con USDC de prueba: copia la dirección de arriba y pégala en{" "}
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            faucet.circle.com
          </a>{" "}
          (red Stellar). El trustline ya está establecido.
        </p>
      </Card>

      {evaluated.length > 0 && (
        <Card title="Métricas">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Gastos procesados" value={String(evaluated.length)} />
            <StatTile
              label="Solo reglas"
              value={String(rulesOnly.length)}
              hint={`${pct(rulesOnly.length)}%`}
            />
            <StatTile
              label="Resuelto con Jev"
              value={String(jevDecided.length)}
              hint={`${pct(jevDecided.length)}%`}
            />
            <StatTile
              label="Escalado a revisión"
              value={String(escalated.length)}
              hint={`${pct(escalated.length)}%`}
            />
            <StatTile
              label="Latencia prom. Jev"
              value={avgJevLatency !== null ? `${avgJevLatency}ms` : "—"}
            />
            <StatTile
              label="USDC liquidado"
              value={usdcSettled.toFixed(2)}
              hint={`${paid.length} pago${paid.length === 1 ? "" : "s"}`}
            />
          </div>
          {withBoth.length > 0 && (
            <p className="rounded-lg border border-border-subtle bg-surface-muted p-3 text-xs text-text-secondary">
              Panel comparativo Jev vs. LLM genérico ({withBoth.length} gasto
              {withBoth.length === 1 ? "" : "s"}): latencia promedio Jev{" "}
              <strong>{jevAvgLatencyComparative}ms</strong> vs. LLM genérico{" "}
              <strong>{shadowAvgLatency}ms</strong> — coinciden en el veredicto{" "}
              <strong>
                {agreements}/{withBoth.length}
              </strong>
              .
            </p>
          )}
        </Card>
      )}

      <Card title="Política de gastos">
        <PolicyForm companyId={company.id} defaultText={company.policy?.rawText} />
        {company.policy && (
          <PolicyEditor
            companyId={company.id}
            structured={company.policy.structured as unknown as StructuredPolicy}
          />
        )}
      </Card>

      <Card title="Empleados">
        {company.employees.length === 0 ? (
          <p className="text-sm text-text-secondary">Aún no hay empleados registrados.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {company.employees.map((employee, i) => (
              <li
                key={employee.id}
                className="rounded-lg border border-border-subtle bg-surface-muted p-4"
              >
                <p className="font-medium">
                  {employee.name} — <span className="text-text-secondary">{employee.role}</span>
                </p>
                <p className="text-sm text-text-secondary">{employee.email}</p>
                <p className="break-all font-mono text-xs text-text-secondary">
                  {employee.walletPublicKey}
                </p>
                <div className="flex gap-6 text-sm">
                  <span>
                    XLM: <strong className="tabular-nums">{employeeBalances[i].xlm}</strong>
                  </span>
                  <span>
                    USDC: <strong className="tabular-nums">{employeeBalances[i].usdc}</strong>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <EmployeeForm companyId={company.id} />
      </Card>

      <Card title="Gastos">
        <ExpenseUploadForm
          companyId={company.id}
          employees={company.employees.map((e) => ({ id: e.id, name: e.name }))}
        />

        {pending.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-text-secondary">Pendientes de confirmación</h3>
            {pending.map((expense) => {
              const extracted = expense.extractedData as { confidence?: number } | null;
              return (
                <ExpenseConfirmForm
                  key={expense.id}
                  expenseId={expense.id}
                  employeeName={expense.employee.name}
                  receiptDataUrl={`data:${expense.receiptMimeType};base64,${Buffer.from(expense.receiptFile).toString("base64")}`}
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
              <button
                type="submit"
                className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
              >
                Filtrar
              </button>
              {(statusFilter !== "ALL" || employeeFilter !== "ALL" || categoryFilter !== "ALL") && (
                <a href="/dashboard" className="text-xs underline">
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
                        <span className="font-medium">{expense.employee.name}</span> —{" "}
                        {expense.merchant} —{" "}
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
                      {evaluation && (
                        <div className="flex flex-col gap-0.5 border-t border-border-subtle pt-2 text-xs">
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
                        <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-2 text-xs md:grid-cols-2">
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
                          <div>
                            <p className="font-medium text-text-secondary">
                              LLM genérico (comparativo) —{" "}
                              {shadow?.error
                                ? "error"
                                : shadow
                                  ? `${shadow.provider}/${shadow.model}, ${shadow.latencyMs}ms`
                                  : "sin datos (gasto evaluado antes de esta función)"}
                            </p>
                            {shadow && !shadow.error ? (
                              <ul>
                                <li>Cumple política: {Math.round(shadow.compliesWithPolicy * 100)}%</li>
                                <li>Propósito válido: {Math.round(shadow.businessPurposeValid * 100)}%</li>
                                <li>Evidencia suficiente: {Math.round(shadow.evidenceSufficient * 100)}%</li>
                                <li>Requiere revisión: {Math.round(shadow.requiresReview * 100)}%</li>
                                {shadow.roleRelevant !== undefined && (
                                  <li>Relevante al rol: {Math.round(shadow.roleRelevant * 100)}%</li>
                                )}
                                <li>
                                  Veredicto: {shadow.outcome}{" "}
                                  {decision && shadow.outcome === decision.outcome ? "(coincide)" : "(difiere)"}
                                </li>
                              </ul>
                            ) : (
                              shadow?.error && <p className="text-status-critical">{shadow.error}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
