import { prisma } from "@/lib/prisma";
import { evaluateExpenseRules } from "@/lib/rules/engine";
import { evaluateExpenseWithJev } from "@/lib/jev/evaluate";
import { evaluateExpenseShadow } from "@/lib/shadow/evaluate";
import { decideExpense } from "@/lib/decision/engine";
import { sendUsdcPayment } from "@/lib/stellar";
import { releaseVaultPayment } from "@/lib/stellar/vault";
import { decryptSecret } from "@/lib/crypto";
import type { StructuredPolicy } from "@/lib/policy/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";
import type { DecisionResult } from "@/lib/decision/types";
import { estimateCostUsd } from "@/lib/pricing";

export type ComparativeOutcome = "APPROVED" | "REJECTED" | "REVIEW_REQUIRED" | "ERROR";

/**
 * Lectura de un solo motor (Jev o el LLM comparativo), aislada de las reglas
 * determinísticas — a diferencia de `decision`, que sí las incluye y es la
 * única que autoriza pagos. Solo para mostrar "Jev vs LLM" lado a lado en la
 * UI (carga masiva); nunca se usa para decidir nada.
 */
export interface EngineComparativeResult {
  outcome: ComparativeOutcome;
  compliesWithPolicy?: number;
  businessPurposeValid?: number;
  evidenceSufficient?: number;
  requiresReview?: number;
  /** Solo presente si la categoría exige relevancia de rol. */
  roleRelevant?: number;
  model?: string;
  provider?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** USD estimado, o `undefined` si no hay precio configurado para esta fuente (ver src/lib/pricing.ts). */
  costUsd?: number;
  error?: string;
}

export interface PipelineResult {
  decision: DecisionResult;
  paymentTxHash?: string;
  paymentError?: string;
  paidViaVault?: boolean;
  jev?: EngineComparativeResult;
  shadow?: EngineComparativeResult;
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

  // Vista comparativa "Jev vs LLM" para la carga masiva (UI): mismo umbral
  // que decideExpense pero ignorando las reglas, para que ambas columnas
  // reflejen únicamente el juicio semántico de cada motor. Reutiliza
  // decideExpense en vez de duplicar los umbrales (ver src/lib/shadow, que sí
  // los duplica a propósito porque esa vía debe poder evolucionar sola).
  const passthroughRules = { allPassed: true, categoryMatched: true, checks: [] };
  const jevComparative: EngineComparativeResult | undefined = jevResult
    ? {
        outcome: jevResult.error ? "ERROR" : decideExpense(passthroughRules, jevResult).outcome,
        compliesWithPolicy: jevResult.compliesWithPolicy?.probability,
        businessPurposeValid: jevResult.businessPurposeValid?.probability,
        evidenceSufficient: jevResult.evidenceSufficient?.probability,
        requiresReview: jevResult.requiresReview?.probability,
        roleRelevant: jevResult.roleRelevant?.probability,
        model: jevResult.model,
        latencyMs: jevResult.latencyMs,
        inputTokens: jevResult.inputTokens,
        outputTokens: jevResult.outputTokens,
        costUsd: estimateCostUsd("jev", jevResult.inputTokens, jevResult.outputTokens),
        error: jevResult.error,
      }
    : undefined;
  const shadowComparative: EngineComparativeResult | undefined = shadowResult
    ? {
        outcome: shadowResult.error ? "ERROR" : shadowResult.outcome,
        compliesWithPolicy: shadowResult.compliesWithPolicy,
        requiresReview: shadowResult.requiresReview,
        model: shadowResult.model,
        provider: shadowResult.provider,
        latencyMs: shadowResult.latencyMs,
        inputTokens: shadowResult.inputTokens,
        outputTokens: shadowResult.outputTokens,
        costUsd:
          shadowResult.provider === "openai" || shadowResult.provider === "gemini"
            ? estimateCostUsd(shadowResult.provider, shadowResult.inputTokens, shadowResult.outputTokens)
            : undefined,
        error: shadowResult.error,
      }
    : undefined;

  // AI recommends. Policy decides. Stellar executes. — el pago solo se
  // intenta cuando el motor de decisión aprobó, y usa el resultado de
  // `decision` (reglas + Jev), nunca el de la vía shadow.
  let paymentTxHash: string | undefined;
  let paymentError: string | undefined;
  let paidAt: Date | undefined;
  let paidViaVault = false;

  if (decision.outcome === "APPROVED" && employee) {
    const company = await prisma.company.findUnique({ where: { id: expense.companyId } });
    if (company) {
      // Si el vault on-chain está inicializado y este empleado está
      // registrado en él, el pago sale por `release_payment` (firmado por el
      // operador, tope forzado por el contrato) en vez del pago clásico
      // firmado con la llave completa del treasury. Ver contracts/spending-vault.
      const useVault = Boolean(
        company.vaultInitialized && company.vaultContractId && employee.vaultRegistered,
      );
      const payment = useVault
        ? await releaseVaultPayment({
            contractId: company.vaultContractId!,
            operatorSecret: decryptSecret(company.vaultOperatorSecretEncrypted!),
            employeePublicKey: employee.walletPublicKey,
            amountUsdc: expense.amount!,
          })
        : await sendUsdcPayment(
            decryptSecret(company.treasurySecretKeyEncrypted),
            employee.walletPublicKey,
            expense.amount!,
          );
      if (payment.success) {
        paymentTxHash = payment.hash;
        paidAt = new Date();
        paidViaVault = useVault;
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
      paidViaVault,
    },
  });

  return { decision, paymentTxHash, paymentError, paidViaVault, jev: jevComparative, shadow: shadowComparative };
}
