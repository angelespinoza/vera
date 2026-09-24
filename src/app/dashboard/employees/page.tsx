import { getCompany } from "../data";
import { getAccountBalances } from "@/lib/stellar";
import { Card, truncateKey } from "../ui";
import { EmployeeForm } from "../employee-form";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const company = await getCompany();
  if (!company) return null;

  const employeeBalances = await Promise.all(
    company.employees.map((employee) => getAccountBalances(employee.walletPublicKey)),
  );

  return (
    <Card title="Empleados">
      {company.employees.length === 0 ? (
        <p className="text-sm text-text-secondary">Aún no hay empleados registrados.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {company.employees.map((employee, i) => (
            <li key={employee.id} className="rounded-lg border border-border-subtle bg-surface-muted p-4">
              <p className="font-medium">
                {employee.name} — <span className="text-text-secondary">{employee.role}</span>
              </p>
              <p className="text-sm text-text-secondary">{employee.email}</p>
              <p className="font-mono text-xs text-text-secondary" title={employee.walletPublicKey}>
                {truncateKey(employee.walletPublicKey)}
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
  );
}
