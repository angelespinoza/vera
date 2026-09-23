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

        {company.expenses.filter((e) => e.status === "SUBMITTED").length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-zinc-500">Confirmados</h3>
            <ul className="flex flex-col gap-2">
              {company.expenses
                .filter((e) => e.status === "SUBMITTED")
                .map((expense) => {
                  const evaluation = expense.ruleResults as unknown as RuleEvaluationResult | null;
                  return (
                    <li
                      key={expense.id}
                      className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                    >
                      <span className="font-medium">{expense.employee.name}</span> —{" "}
                      {expense.merchant} — {expense.amount} {expense.currency} —{" "}
                      <span className="text-zinc-500">{expense.category}</span>
                      <p className="text-zinc-500">{expense.justification}</p>
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
