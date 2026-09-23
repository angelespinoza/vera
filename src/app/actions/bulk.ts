"use server";

import { prisma } from "@/lib/prisma";
import { evaluateAndDecideExpense } from "@/lib/expense/pipeline";
import type { DecisionOutcome } from "@/lib/decision/types";

export interface BulkRowInput {
  employeeEmail: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  /** YYYY-MM-DD */
  expenseDate: string;
  justification: string;
}

export interface BulkRowResult {
  ok: boolean;
  error?: string;
  employeeName?: string;
  outcome?: DecisionOutcome;
  reason?: string;
  paymentTxHash?: string;
}

/**
 * Procesa una fila de la carga masiva de Excel (Etapa 9+ / demo): crea el
 * gasto ya "confirmado" (sin foto — bulkImported: true) y lo corre por el
 * mismo pipeline de reglas → Jev → decisión → pago que el flujo normal.
 * Se llama una fila a la vez desde el cliente para mostrar la simulación
 * en vivo (ver src/app/dashboard/bulk-upload.tsx).
 */
export async function processBulkExpenseRow(
  companyId: string,
  row: BulkRowInput,
): Promise<BulkRowResult> {
  if (
    !row.employeeEmail ||
    !row.merchant ||
    !row.amount ||
    Number.isNaN(row.amount) ||
    !row.currency ||
    !row.category ||
    !row.expenseDate ||
    !row.justification
  ) {
    return { ok: false, error: "Fila incompleta o con datos inválidos." };
  }

  const employee = await prisma.employee.findFirst({
    where: { companyId, email: { equals: row.employeeEmail, mode: "insensitive" } },
  });
  if (!employee) {
    return { ok: false, error: `Empleado no encontrado: ${row.employeeEmail}` };
  }

  const expenseDate = new Date(row.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) {
    return { ok: false, error: `Fecha inválida: ${row.expenseDate}` };
  }

  const expense = await prisma.expense.create({
    data: {
      companyId,
      employeeId: employee.id,
      amount: row.amount,
      currency: row.currency,
      merchant: row.merchant,
      category: row.category,
      expenseDate,
      justification: row.justification,
      status: "SUBMITTED",
      bulkImported: true,
    },
  });

  const result = await evaluateAndDecideExpense(expense.id);
  if (!result) {
    return { ok: false, error: "Define una política de gastos antes de procesar la carga masiva." };
  }

  return {
    ok: true,
    employeeName: employee.name,
    outcome: result.decision.outcome,
    reason: result.decision.reason,
    paymentTxHash: result.paymentTxHash,
  };
}
