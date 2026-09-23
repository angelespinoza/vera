"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { compilePolicy } from "@/lib/policy/compiler";
import type { StructuredPolicy } from "@/lib/policy/types";
import type { ActionState } from "./company";

export async function generatePolicy(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();

  if (!companyId || !rawText) {
    return { error: "Falta el texto de la política." };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return { error: "Empresa no encontrada." };
  }

  let structured: StructuredPolicy;
  try {
    structured = await compilePolicy(rawText);
  } catch (err) {
    return {
      error: `No se pudo generar la política automáticamente: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await prisma.policy.upsert({
    where: { companyId },
    create: { companyId, rawText, structured: structured as object },
    update: { rawText, structured: structured as object },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function updatePolicyStructured(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const structuredJson = String(formData.get("structuredJson") ?? "").trim();

  if (!companyId || !structuredJson) {
    return { error: "Falta la estructura de la política." };
  }

  let structured: StructuredPolicy;
  try {
    structured = JSON.parse(structuredJson);
  } catch {
    return { error: "El JSON de la política no es válido." };
  }

  const existing = await prisma.policy.findUnique({ where: { companyId } });
  if (!existing) {
    return { error: "Esta empresa todavía no tiene una política generada." };
  }

  await prisma.policy.update({
    where: { companyId },
    data: { structured: structured as object },
  });

  revalidatePath("/dashboard");
  return {};
}
