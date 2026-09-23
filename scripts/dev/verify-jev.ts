import { evaluateExpenseWithJev } from "../../src/lib/jev/evaluate.ts";

// Caso 1: gasto de software, requiere relevancia de rol.
const result1 = await evaluateExpenseWithJev({
  merchant: "Notion Labs",
  amount: 240,
  currency: "USD",
  category: "software",
  expenseDate: "2026-09-15",
  justification: "Suscripción anual a Notion para gestionar el roadmap de producto y documentación del equipo.",
  employeeName: "Angel Espinoza",
  employeeRole: "Product Manager",
  categoryRule: {
    category: "software",
    label: "Software",
    maxAmount: 300,
    maxAmountPeriod: "annually",
    requiresRoleRelevance: true,
  },
});
console.log("Caso 1 (software, PM) ->", JSON.stringify(result1, null, 2));

// Caso 2: gasto vago, sin categoryRule con requiresRoleRelevance.
const result2 = await evaluateExpenseWithJev({
  merchant: "Random Store",
  amount: 45,
  currency: "USD",
  category: "meals",
  expenseDate: "2026-09-15",
  justification: "gastos varios",
  employeeName: "Angel Espinoza",
  employeeRole: "Product Manager",
  categoryRule: {
    category: "meals",
    label: "Meals",
    maxAmount: 75,
    maxAmountPeriod: "per_day",
  },
});
console.log("\nCaso 2 (justificación vaga) ->", JSON.stringify(result2, null, 2));
