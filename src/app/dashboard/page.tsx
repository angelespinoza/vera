import { prisma } from "@/lib/prisma";
import { getAccountBalances, stellarExpertAccountUrl } from "@/lib/stellar";
import { CompanyForm } from "./company-form";
import { EmployeeForm } from "./employee-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: { employees: { orderBy: { createdAt: "asc" } } },
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
    </main>
  );
}
