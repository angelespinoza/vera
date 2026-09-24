import type { ReactNode } from "react";
import { getCompany, EVALUATED_STATUSES } from "./data";
import { CompanyForm } from "./company-form";
import { Card } from "./ui";
import { Sidebar, SectionNav, type NavSection } from "./nav";
import { IconTreasury, IconMetrics, IconPolicy, IconEmployees, IconExpenses } from "./icons";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const company = await getCompany();

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

  const evaluatedCount = company.expenses.filter((e) => EVALUATED_STATUSES.includes(e.status)).length;
  const pendingCount = company.expenses.filter((e) => e.status === "EXTRACTED").length;

  const navSections: NavSection[] = [
    { id: "treasury", label: "Treasury", icon: <IconTreasury />, href: "/dashboard" },
    ...(evaluatedCount > 0
      ? [{ id: "metrics", label: "Métricas", icon: <IconMetrics />, href: "/dashboard/metrics" }]
      : []),
    { id: "policy", label: "Política", icon: <IconPolicy />, href: "/dashboard/policy" },
    { id: "employees", label: "Empleados", icon: <IconEmployees />, href: "/dashboard/employees" },
    { id: "expenses", label: "Gastos", icon: <IconExpenses />, href: "/dashboard/expenses", badge: pendingCount },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar companyName={company.name} sections={navSections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SectionNav sections={navSections} />
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-8">
          <header className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-text-secondary uppercase md:hidden">
              Vera — CFO Agent
            </p>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-text-secondary">CFO: {company.cfoEmail}</p>
          </header>

          {(!company.policy || company.employees.length === 0) && (
            <Card className="border-status-warning/40 bg-status-warning/5">
              <p className="text-sm font-semibold">Primeros pasos</p>
              <ol className="flex flex-col gap-1 text-sm text-text-secondary">
                <li className={company.policy ? "line-through opacity-60" : ""}>
                  1. Define la política de gastos en{" "}
                  <a href="/dashboard/policy" className="underline">
                    Política de gastos
                  </a>
                  .
                </li>
                <li className={company.employees.length > 0 ? "line-through opacity-60" : ""}>
                  2. Da de alta al menos un empleado en{" "}
                  <a href="/dashboard/employees" className="underline">
                    Empleados
                  </a>
                  .
                </li>
                <li>
                  3. Sube el primer comprobante en{" "}
                  <a href="/dashboard/expenses" className="underline">
                    Gastos
                  </a>
                  .
                </li>
              </ol>
            </Card>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
