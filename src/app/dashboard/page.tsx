import { prisma } from "@/lib/prisma";
import { getAccountBalances, stellarExpertAccountUrl } from "@/lib/stellar";
import type { StructuredPolicy } from "@/lib/policy/types";
import { CompanyForm } from "./company-form";
import { EmployeeForm } from "./employee-form";
import { PolicyForm } from "./policy-form";
import { PolicyEditor } from "./policy-editor";
import { ExpenseUploadForm } from "./expense-upload-form";
import { ExpenseConfirmForm } from "./expense-confirm-form";
import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "@/lib/decision/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

const DECISION_LABEL: Record<string, string> = {
  APPROVED: "APROBADO",
  REJECTED: "RECHAZADO",
  REVIEW_REQUIRED: "REQUIERE REVISIÓN",
};

const DECISION_COLOR: Record<string, string> = {
  APPROVED: "text-green-600",
  REJECTED: "text-red-600",
  REVIEW_REQUIRED: "text-amber-600",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">CFO: {company.cfoEmail}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Treasury (Stellar testnet)</h2>
        <p className="break-all font-mono text-xs text-zinc-500">
          {company.treasuryPublicKey}
        </p>
        <div className="flex gap-6 text-sm">
          <span>
            XLM: <strong>{treasuryBalances.xlm}</strong>
          </span>
          <span>
            USDC: <strong>{treasuryBalances.usdc}</strong>
          </span>
        </div>
        <a
          href={stellarExpertAccountUrl(company.treasuryPublicKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Ver en Stellar Expert
        </a>
        <p className="text-xs text-zinc-500">
          Para fondear con USDC de prueba: copia la dirección de arriba y
          pégala en{" "}
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
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Política de gastos</h2>
        <PolicyForm companyId={company.id} defaultText={company.policy?.rawText} />
        {company.policy && (
          <PolicyEditor
            companyId={company.id}
            structured={company.policy.structured as unknown as StructuredPolicy}
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Empleados</h2>
        {company.employees.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Aún no hay empleados registrados.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {company.employees.map((employee, i) => (
              <li
                key={employee.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium">
                  {employee.name} — <span className="text-zinc-500">{employee.role}</span>
                </p>
                <p className="text-sm text-zinc-500">{employee.email}</p>
                <p className="break-all font-mono text-xs text-zinc-500">
                  {employee.walletPublicKey}
                </p>
                <div className="flex gap-6 text-sm">
                  <span>
                    XLM: <strong>{employeeBalances[i].xlm}</strong>
                  </span>
                  <span>
                    USDC: <strong>{employeeBalances[i].usdc}</strong>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <EmployeeForm companyId={company.id} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Gastos</h2>
        <ExpenseUploadForm
          companyId={company.id}
          employees={company.employees.map((e) => ({ id: e.id, name: e.name }))}
        />

        {company.expenses.filter((e) => e.status === "EXTRACTED").length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-zinc-500">Pendientes de confirmación</h3>
            {company.expenses
              .filter((e) => e.status === "EXTRACTED")
              .map((expense) => {
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

        {company.expenses.filter((e) =>
          ["APPROVED", "REJECTED", "REVIEW_REQUIRED"].includes(e.status),
        ).length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-zinc-500">Evaluados</h3>
            {(() => {
              const withBoth = company.expenses.filter((e) => {
                const j = e.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
                const s = e.shadowResults as unknown as (ShadowEvaluationResult & { error?: string }) | null;
                return j && !j.error && s && !s.error;
              });
              if (withBoth.length === 0) return null;
              const jevLatencies = withBoth.map(
                (e) => (e.jevResults as unknown as JevEvaluationResult).latencyMs,
              );
              const shadowLatencies = withBoth.map(
                (e) => (e.shadowResults as unknown as ShadowEvaluationResult).latencyMs,
              );
              const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
              const agreements = withBoth.filter((e) => {
                const decision = e.decision as unknown as DecisionResult | null;
                const shadow = e.shadowResults as unknown as ShadowEvaluationResult;
                return decision && decision.outcome === shadow.outcome;
              }).length;
              return (
                <p className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">
                  Panel comparativo Jev vs. LLM genérico ({withBoth.length} gasto
                  {withBoth.length === 1 ? "" : "s"}): latencia promedio Jev{" "}
                  <strong>{avg(jevLatencies)}ms</strong> vs. LLM genérico{" "}
                  <strong>{avg(shadowLatencies)}ms</strong> — coinciden en el veredicto{" "}
                  <strong>
                    {agreements}/{withBoth.length}
                  </strong>
                  .
                </p>
              );
            })()}
            <ul className="flex flex-col gap-2">
              {company.expenses
                .filter((e) => ["APPROVED", "REJECTED", "REVIEW_REQUIRED"].includes(e.status))
                .map((expense) => {
                  const evaluation = expense.ruleResults as unknown as RuleEvaluationResult | null;
                  const jev = expense.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
                  const shadow = expense.shadowResults as unknown as
                    | (ShadowEvaluationResult & { error?: string })
                    | null;
                  const decision = expense.decision as unknown as DecisionResult | null;
                  return (
                    <li
                      key={expense.id}
                      className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                    >
                      {decision && (
                        <p className={`text-sm font-bold ${DECISION_COLOR[decision.outcome] ?? ""}`}>
                          {DECISION_LABEL[decision.outcome] ?? decision.outcome}
                        </p>
                      )}
                      <span className="font-medium">{expense.employee.name}</span> —{" "}
                      {expense.merchant} — {expense.amount} {expense.currency} —{" "}
                      <span className="text-zinc-500">{expense.category}</span>
                      <p className="text-zinc-500">{expense.justification}</p>
                      {decision && <p className="mt-1 text-xs text-zinc-500">{decision.reason}</p>}
                      {evaluation && (
                        <div className="mt-2 flex flex-col gap-0.5 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-900">
                          <p className="font-medium text-zinc-500">
                            Reglas determinísticas:{" "}
                            {evaluation.allPassed ? (
                              <span className="text-green-600">todas pasaron</span>
                            ) : (
                              <span className="text-red-600">hay reglas que fallaron</span>
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
                        <div className="mt-2 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-900 md:grid-cols-2">
                          <div>
                            <p className="font-medium text-zinc-500">
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
                              jev?.error && <p className="text-red-600">{jev.error}</p>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-zinc-500">
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
                                  Veredicto: {DECISION_LABEL[shadow.outcome] ?? shadow.outcome}{" "}
                                  {decision && shadow.outcome === decision.outcome ? "(coincide)" : "(difiere)"}
                                </li>
                              </ul>
                            ) : (
                              shadow?.error && <p className="text-red-600">{shadow.error}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
