"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createFundedTestWallet } from "@/lib/stellar";
import { encryptSecret } from "@/lib/crypto";
import type { ActionState } from "./company";

export async function createEmployee(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!companyId || !name || !email || !role) {
    return { error: "Todos los campos son requeridos." };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return { error: "Empresa no encontrada." };
  }

  const existing = await prisma.employee.findUnique({
    where: { companyId_email: { companyId, email } },
  });
  if (existing) {
    return { error: "Ya existe un empleado con ese email en esta empresa." };
  }

  const wallet = await createFundedTestWallet();

  await prisma.employee.create({
    data: {
      companyId,
      name,
      email,
      role,
      walletPublicKey: wallet.publicKey,
      walletSecretKeyEncrypted: encryptSecret(wallet.secretKey),
    },
  });

  revalidatePath("/dashboard");
  return {};
}
