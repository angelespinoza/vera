import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { evaluateExpenseRules } from "../../src/lib/rules/engine.ts";
import type { StructuredPolicy } from "../../src/lib/policy/types.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const company = await prisma.company.findFirst({ include: { policy: true, employees: true } });
if (!company || !company.policy) throw new Error("Falta company/policy de prueba");

const employee = company.employees[0];

// Gasto sintético que debería cumplir todas las reglas: dentro del límite,
// sin ítems prohibidos, comprobante único, fecha pasada.
const evaluation = await evaluateExpenseRules(
  {
    id: "fake-id-for-check",
    employeeId: employee.id,
    companyId: company.id,
    amount: 40,
    currency: "USD",
    merchant: "Cafe Central",
    category: "meals",
    expenseDate: new Date("2026-09-19"),
    justification: "Almuerzo de trabajo con proveedor.",
    receiptHash: "hash-unico-de-prueba-que-no-existe",
  },
  company.policy.structured as unknown as StructuredPolicy,
);

console.log(JSON.stringify(evaluation, null, 2));
await prisma.$disconnect();
