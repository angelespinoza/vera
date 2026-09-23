import { prisma } from "@/lib/prisma";
import { evaluateExpenseRules } from "@/lib/rules/engine";
import { evaluateExpenseWithJev } from "@/lib/jev/evaluate";
import { evaluateExpenseShadow } from "@/lib/shadow/evaluate";
import { decideExpense } from "@/lib/decision/engine";
import { sendUsdcPayment } from "@/lib/stellar";
import { decryptSecret } from "@/lib/crypto";
import type { StructuredPolicy } from "@/lib/policy/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";
import type { DecisionResult } from "@/lib/decision/types";

export interface PipelineResult {
  decision: DecisionResult;
  paymentTxHash?: string;
  paymentError?: string;
}

/**
 * Corre reglas → Jev + LLM genérico (en paralelo) → decisión → pago (solo si
 * aprueba) sobre un Expense ya persistido con sus campos confirmados (amount,
 * currency, merchant, category, expenseDate, justification).
 *
 * Compartido por el flujo normal (confirmExpense, un gasto a la vez con foto)
 * y la carga masiva de Excel (bulk.ts, sin foto). `null` si el gasto no
 * existe o la empresa aún no tiene política definida.
 */
export async function evaluateAndDecideExpense(expenseId: string): Promise<PipelineResult | null> {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return null;

  const policy = await prisma.policy.findUnique({ where: { companyId: expense.companyId } });
  const employee = await prisma.employee.findUnique({ where: { id: expense.employeeId } });
  if (!policy) return null;

  const structuredPolicy = policy.structured as unknown as StructuredPolicy;
  const ruleEvaluation = await evaluateExpenseRules(
    {
      id: expense.id,
      employeeId: expense.employeeId,
      companyId: expense.companyId,
      amount: expense.amount!,
      currency: expense.currency!,
      merchant: expense.merchant!,
      category: expense.category!,
      expenseDate: expense.expenseDate!,
      justification: expense.justification!,
      receiptHash: expense.receiptHash,
    },
    structuredPolicy,
  );

  let jevResult: (JevEvaluationResult & { error?: string }) | null = null;
  let shadowResult: (ShadowEvaluationResult & { error?: string }) | null = null;

  if (employee) {
    const categoryRule = structuredPolicy.categories.find((c) => c.category === expense.category);
    const jevInput = {
      merchant: expense.merchant!,
      amount: expense.amount!,
      currency: expense.currency!,
      category: expense.category!,
      expenseDate: expense.expenseDate!.toISOString().slice(0, 10),
      justification: expense.justification!,
      employeeName: employee.name,
      employeeRole: employee.role,
      categoryRule,
    };

    // Jev es la vía oficial que alimenta `decision`. La vía shadow (LLM
    // genérico) corre en paralelo solo para comparar velocidad/acierto
    // (Etapa 7) — nunca participa en la decisión real.
    const [jevSettled, shadowSettled] = await Promise.allSettled([
      evaluateExpenseWithJev(jevInput),
      evaluateExpenseShadow(jevInput),
    ]);

    jevResult =
      jevSettled.status === "fulfilled"
        ? jevSettled.value
        : ({ error: String(jevSettled.reason) } as JevEvaluationResult & { error: string });

    shadowResult =
      shadowSettled.status === "fulfilled"
        ? shadowSettled.value
        : ({ error: String(shadowSettled.reason) } as ShadowEvaluationResult & { error: string });
  }

  const decision = decideExpense(ruleEvaluation, jevResult);

  // AI recommends. Policy decides. Stellar executes. — el pago solo se
  // intenta cuando el motor de decisión aprobó, y usa el resultado de
  // `decision` (reglas + Jev), nunca el de la vía shadow.
  let paymentTxHash: string | undefined;
  let paymentError: string | undefined;
  let paidAt: Date | undefined;

  if (decision.outcome === "APPROVED" && employee) {
    const company = await prisma.company.findUnique({ where: { id: expense.companyId } });
    if (company) {
      const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
      const payment = await sendUsdcPayment(treasurySecret, employee.walletPublicKey, expense.amount!);
      if (payment.success) {
        paymentTxHash = payment.hash;
        paidAt = new Date();
      } else {
        paymentError = payment.error;
      }
    }
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ruleResults: ruleEvaluation as object,
      jevResults: jevResult as unknown as object,
      shadowResults: shadowResult as unknown as object,
      policySnapshot: structuredPolicy as unknown as object,
      decision: decision as unknown as object,
      status: decision.outcome,
      paymentTxHash,
      paymentError,
      paidAt,
    },
  });

  return { decision, paymentTxHash, paymentError };
}
