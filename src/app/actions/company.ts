"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createFundedTestWallet } from "@/lib/stellar";
import { encryptSecret } from "@/lib/crypto";

export interface ActionState {
  error?: string;
}

export async function createCompany(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const cfoEmail = String(formData.get("cfoEmail") ?? "").trim();

  if (!name || !cfoEmail) {
    return { error: "Nombre y email del CFO son requeridos." };
  }

  const existing = await prisma.company.findUnique({ where: { cfoEmail } });
  if (existing) {
    return { error: "Ya existe una empresa registrada con ese email de CFO." };
  }

  // Trustline + friendbot pueden tardar unos segundos en testnet.
  const treasury = await createFundedTestWallet();

  await prisma.company.create({
    data: {
      name,
      cfoEmail,
      treasuryPublicKey: treasury.publicKey,
      treasurySecretKeyEncrypted: encryptSecret(treasury.secretKey),
    },
  });

  revalidatePath("/dashboard");
  return {};
}
