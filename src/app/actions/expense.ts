"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/receipt/extract";
import { evaluateExpenseRules } from "@/lib/rules/engine";
import { evaluateExpenseWithJev } from "@/lib/jev/evaluate";
import { evaluateExpenseShadow } from "@/lib/shadow/evaluate";
import { decideExpense } from "@/lib/decision/engine";
import { sendUsdcPayment } from "@/lib/stellar";
import { decryptSecret } from "@/lib/crypto";
import type { StructuredPolicy } from "@/lib/policy/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";
import type { ActionState } from "./company";

export async function uploadExpenseReceipt(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const file = formData.get("receipt") as File | null;

  if (!companyId || !employeeId || !file || file.size === 0) {
    return { error: "Selecciona un empleado y un archivo de comprobante." };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.companyId !== companyId) {
    return { error: "Empleado no encontrado." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const receiptHash = createHash("sha256").update(buffer).digest("hex");

  let extracted;
  try {
    extracted = await extractReceiptData(buffer.toString("base64"), mimeType);
  } catch (err) {
    return {
      error: `No se pudo extraer datos del comprobante: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await prisma.expense.create({
    data: {
      companyId,
      employeeId,
      receiptFile: buffer,
      receiptMimeType: mimeType,
      receiptHash,
      extractedData: extracted as object,
      amount: extracted.amount,
      currency: extracted.currency,
      merchant: extracted.merchant,
      expenseDate: extracted.date ? new Date(extracted.date) : undefined,
      category: extracted.category,
      status: "EXTRACTED",
    },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function confirmExpense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const expenseId = String(formData.get("expenseId") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const expenseDateStr = String(formData.get("expenseDate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const justification = String(formData.get("justification") ?? "").trim();

  const amount = Number(amountStr);

  if (
    !expenseId ||
    !amountStr ||
    Number.isNaN(amount) ||
    !currency ||
    !merchant ||
    !expenseDateStr ||
    !category ||
    !justification
  ) {
    return { error: "Todos los campos son requeridos para confirmar el gasto." };
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      amount,
      currency,
      merchant,
      expenseDate: new Date(expenseDateStr),
      category,
      justification,
      status: "SUBMITTED",
    },
  });

  const policy = await prisma.policy.findUnique({ where: { companyId: updated.companyId } });
  const employee = await prisma.employee.findUnique({ where: { id: updated.employeeId } });

  if (!policy) {
    // Sin política no hay nada contra qué evaluar — el gasto queda SUBMITTED,
    // pendiente de que el CFO defina una política.
    revalidatePath("/dashboard");
    return {};
  }

  const structuredPolicy = policy.structured as unknown as StructuredPolicy;
  const ruleEvaluation = await evaluateExpenseRules(
    {
      id: updated.id,
      employeeId: updated.employeeId,
      companyId: updated.companyId,
      amount: updated.amount!,
      currency: updated.currency!,
      merchant: updated.merchant!,
      category: updated.category!,
      expenseDate: updated.expenseDate!,
      justification: updated.justification!,
      receiptHash: updated.receiptHash,
    },
    structuredPolicy,
  );

  let jevResult: (JevEvaluationResult & { error?: string }) | null = null;
  let shadowResult: (ShadowEvaluationResult & { error?: string }) | null = null;

  if (employee) {
    const categoryRule = structuredPolicy.categories.find((c) => c.category === updated.category);
    const jevInput = {
      merchant: updated.merchant!,
      amount: updated.amount!,
      currency: updated.currency!,
      category: updated.category!,
      expenseDate: updated.expenseDate!.toISOString().slice(0, 10),
      justification: updated.justification!,
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
    const company = await prisma.company.findUnique({ where: { id: updated.companyId } });
    if (company) {
      const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
      const payment = await sendUsdcPayment(treasurySecret, employee.walletPublicKey, updated.amount!);
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

  revalidatePath("/dashboard");
  return {};
}
