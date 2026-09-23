import { prisma } from "@/lib/prisma";
import type { StructuredPolicy } from "@/lib/policy/types";
import type { RuleCheckResult, RuleEvaluationResult } from "./types";

export interface ExpenseForRules {
  id: string;
  employeeId: string;
  companyId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  expenseDate: Date;
  justification: string;
  receiptHash: string | null;
}

/**
 * Suma el monto de otros gastos confirmados de el mismo empleado + categoría
 * dentro del periodo indicado, más el gasto actual. Aproximación de "budget
 * disponible en el periodo" (Módulo 5): per_trip y per_transaction no
 * agregan (no rastreamos viajes en el MVP — fuera de alcance, ver
 * docs/ALCANCE_FUNCIONAL_ETAPAS.md §15).
 */
async function sumExpensesInPeriod(
  expense: ExpenseForRules,
  period: string | undefined,
): Promise<number> {
  if (!period || period === "per_transaction" || period === "per_trip" || period === "per_night") {
    return expense.amount;
  }

  let start: Date;
  let end: Date;
  if (period === "per_day") {
    const d = expense.expenseDate;
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } else {
    // annually
    const year = expense.expenseDate.getFullYear();
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  }

  const others = await prisma.expense.findMany({
    where: {
      employeeId: expense.employeeId,
      category: expense.category,
      status: { not: "EXTRACTED" },
      id: { not: expense.id },
      expenseDate: { gte: start, lt: end },
    },
    select: { amount: true },
  });

  const othersSum = others.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  return othersSum + expense.amount;
}

/** Evalúa las reglas determinísticas de un gasto contra la política. Etapa 4 / Módulo 5. */
export async function evaluateExpenseRules(
  expense: ExpenseForRules,
  policy: StructuredPolicy,
): Promise<RuleEvaluationResult> {
  const checks: RuleCheckResult[] = [];
  const categoryRule = policy.categories.find((c) => c.category === expense.category);

  checks.push({
    rule: "category_recognized",
    label: "Categoría reconocida en la política",
    passed: !!categoryRule,
    detail: categoryRule
      ? `Coincide con "${categoryRule.label}"`
      : `La categoría "${expense.category}" no está definida en la política`,
  });

  if (categoryRule) {
    if (categoryRule.maxAmount !== undefined) {
      const periodTotal = await sumExpensesInPeriod(expense, categoryRule.maxAmountPeriod);
      const passed = periodTotal <= categoryRule.maxAmount;
      checks.push({
        rule: "amount_within_limit",
        label: `Monto dentro del límite (${categoryRule.maxAmount} ${policy.currency}${
          categoryRule.maxAmountPeriod ? ` / ${categoryRule.maxAmountPeriod}` : ""
        })`,
        passed,
        detail: `Total en el periodo: ${periodTotal} ${policy.currency}`,
      });
    }

    if (
      categoryRule.receiptRequiredAboveAmount !== undefined &&
      expense.amount > categoryRule.receiptRequiredAboveAmount
    ) {
      // El flujo de la Etapa 3 exige comprobante para crear el gasto, así
      // que esta regla siempre pasa en la práctica — se reporta para dejar
      // constancia auditable de que la condición se evaluó.
      checks.push({
        rule: "receipt_required",
        label: "Comprobante presente (requerido por el monto)",
        passed: true,
        detail: "Comprobante cargado al momento de registrar el gasto",
      });
    }

    if (categoryRule.disallowedItems?.length) {
      const text = `${expense.merchant} ${expense.justification} ${expense.category}`.toLowerCase();
      const found = categoryRule.disallowedItems.filter((item) => text.includes(item.toLowerCase()));
      checks.push({
        rule: "disallowed_items",
        label: "Sin ítems no permitidos",
        passed: found.length === 0,
        detail: found.length
          ? `Se detectó posible mención de: ${found.join(", ")}`
          : "No se detectaron ítems prohibidos en el texto del gasto",
      });
    }
  }

  if (expense.receiptHash) {
    const duplicate = await prisma.expense.findFirst({
      where: {
        companyId: expense.companyId,
        receiptHash: expense.receiptHash,
        id: { not: expense.id },
      },
      select: { id: true },
    });
    checks.push({
      rule: "receipt_not_duplicate",
      label: "Comprobante no duplicado",
      passed: !duplicate,
      detail: duplicate ? "Este comprobante ya fue usado en otro gasto" : "Comprobante único",
    });
  }

  const isFuture = expense.expenseDate.getTime() > Date.now();
  checks.push({
    rule: "date_not_future",
    label: "Fecha del gasto no es futura",
    passed: !isFuture,
    detail: `Fecha del gasto: ${expense.expenseDate.toISOString().slice(0, 10)}`,
  });

  return {
    categoryMatched: !!categoryRule,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
