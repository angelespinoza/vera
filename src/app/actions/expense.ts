"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/receipt/extract";
import { evaluateExpenseRules } from "@/lib/rules/engine";
import { evaluateExpenseWithJev } from "@/lib/jev/evaluate";
import type { StructuredPolicy } from "@/lib/policy/types";
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

  if (policy) {
    const structuredPolicy = policy.structured as unknown as StructuredPolicy;
    const evaluation = await evaluateExpenseRules(
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
    await prisma.expense.update({
      where: { id: expenseId },
      data: { ruleResults: evaluation as object },
    });

    if (employee) {
      const categoryRule = structuredPolicy.categories.find((c) => c.category === updated.category);
      try {
        const jevResult = await evaluateExpenseWithJev({
          merchant: updated.merchant!,
          amount: updated.amount!,
          currency: updated.currency!,
          category: updated.category!,
          expenseDate: updated.expenseDate!.toISOString().slice(0, 10),
          justification: updated.justification!,
          employeeName: employee.name,
          employeeRole: employee.role,
          categoryRule,
        });
        await prisma.expense.update({
          where: { id: expenseId },
          data: { jevResults: jevResult as unknown as object },
        });
      } catch (err) {
        await prisma.expense.update({
          where: { id: expenseId },
          data: {
            jevResults: {
              error: err instanceof Error ? err.message : String(err),
            },
          },
        });
      }
    }
  }

  revalidatePath("/dashboard");
  return {};
}
