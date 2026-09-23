"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/receipt/extract";
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

  await prisma.expense.update({
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

  revalidatePath("/dashboard");
  return {};
}
