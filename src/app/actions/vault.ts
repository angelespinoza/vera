"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createFundedTestWallet, getAccountBalances } from "@/lib/stellar";
import {
  USDC_TESTNET_SAC_ID,
  fundVaultFromTreasury,
  initializeVault,
  registerVaultEmployee,
  setVaultOperator,
} from "@/lib/stellar/vault";

// Único contrato SpendingVault desplegado en testnet para este MVP de una
// sola empresa (ver contracts/spending-vault/README.md para el comando de
// build/deploy usado). Si algún día se soporta multi-empresa, esto debe
// volverse un campo que se llena al desplegar, no una constante.
const VAULT_CONTRACT_ID = "CDYOVSKH5ABN62NWWTFTSPLKZVBWOODM6XLUVMHLCALNM7JSLPBBTOGY";

// Tope de vida por empleado en USDC — cifra fija de demo hasta que el vault
// derive límites reales de la política del CFO (Módulo 3) en vez de un
// valor fijo idéntico para todos.
const DEFAULT_EMPLOYEE_LIMIT_USDC = 1000;

export interface VaultActionState {
  error?: string;
  message?: string;
}

/**
 * Inicializa el vault on-chain: genera una llave operadora nueva (nunca
 * reutiliza la del treasury), la registra en el contrato, da de alta a todos
 * los empleados existentes con un tope de demo y fondea el vault con USDC
 * del treasury. Es un flujo de una sola vez por empresa.
 */
export async function initializeVaultAction(
  _prevState: VaultActionState,
  _formData: FormData,
): Promise<VaultActionState> {
  const company = await prisma.company.findFirst({ include: { employees: true } });
  if (!company) return { error: "No hay empresa configurada." };
  if (company.vaultInitialized) return { message: "El vault ya está inicializado." };

  const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
  const operator = await createFundedTestWallet();

  const init = await initializeVault({
    contractId: VAULT_CONTRACT_ID,
    adminSecret: treasurySecret,
    operatorPublicKey: operator.publicKey,
    tokenContractId: USDC_TESTNET_SAC_ID,
  });
  if (!init.success) {
    // Puede que un intento previo haya completado `initialize` on-chain pero
    // el proceso muriera antes de persistir la llave operadora generada (ver
    // setVaultOperator para el detalle). En ese caso el contrato ya está
    // inicializado con una operadora que ya no tenemos — rotamos hacia la
    // operadora nueva que acabamos de generar en vez de fallar.
    const rotated = await setVaultOperator({
      contractId: VAULT_CONTRACT_ID,
      adminSecret: treasurySecret,
      newOperatorPublicKey: operator.publicKey,
    });
    if (!rotated.success) {
      return {
        error: `No se pudo inicializar el vault (${init.error}) ni recuperarlo rotando la operadora (${rotated.error}).`,
      };
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      vaultContractId: VAULT_CONTRACT_ID,
      vaultOperatorPublicKey: operator.publicKey,
      vaultOperatorSecretEncrypted: encryptSecret(operator.secretKey),
      vaultInitialized: true,
    },
  });

  let registeredCount = 0;
  for (const employee of company.employees) {
    const registered = await registerVaultEmployee({
      contractId: VAULT_CONTRACT_ID,
      adminSecret: treasurySecret,
      employeePublicKey: employee.walletPublicKey,
      limitUsdc: DEFAULT_EMPLOYEE_LIMIT_USDC,
    });
    if (registered.success) {
      registeredCount += 1;
      await prisma.employee.update({
        where: { id: employee.id },
        data: { vaultRegistered: true, vaultLimit: DEFAULT_EMPLOYEE_LIMIT_USDC },
      });
    }
  }

  // Fondea con la mitad del USDC disponible en el treasury — en testnet el
  // balance real suele ser pequeño (fondeado a mano vía faucet.circle.com),
  // así que un monto fijo de demo podría exceder lo que hay.
  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);
  const fundingAmount = Math.floor(Number(treasuryBalances.usdc) * 0.5 * 1e7) / 1e7;

  revalidatePath("/dashboard", "layout");

  if (fundingAmount <= 0) {
    return {
      message: `Vault inicializado y ${registeredCount}/${company.employees.length} empleado(s) registrado(s), pero el treasury no tiene USDC para fondearlo — fondéalo vía faucet.circle.com y vuelve a intentar la transferencia manualmente.`,
    };
  }

  const funding = await fundVaultFromTreasury({
    treasurySecret,
    vaultContractId: VAULT_CONTRACT_ID,
    amountUsdc: fundingAmount,
  });

  if (!funding.success) {
    return {
      message: `Vault inicializado y ${registeredCount}/${company.employees.length} empleado(s) registrado(s), pero el fondeo falló: ${funding.error}`,
    };
  }
  return {
    message: `Vault inicializado, ${registeredCount}/${company.employees.length} empleado(s) registrado(s) y fondeado con ${fundingAmount} USDC.`,
  };
}

/**
 * Mueve USDC del treasury al vault ya inicializado. A diferencia del fondeo
 * automático de `initializeVaultAction` (una sola vez, con la mitad del
 * balance de ese momento), esta acción es repetible — para top-ups
 * posteriores después de fondear el treasury vía faucet.circle.com.
 */
export async function topUpVaultAction(
  _prevState: VaultActionState,
  formData: FormData,
): Promise<VaultActionState> {
  const company = await prisma.company.findFirst();
  if (!company) return { error: "No hay empresa configurada." };
  if (!company.vaultInitialized || !company.vaultContractId) {
    return { error: "El vault todavía no está inicializado." };
  }

  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);
  const available = Number(treasuryBalances.usdc);

  const requested = Number(formData.get("amountUsdc"));
  const amountUsdc = Number.isFinite(requested) && requested > 0 ? Math.min(requested, available) : available;

  if (amountUsdc <= 0) {
    return { error: "El treasury no tiene USDC disponible — fondéalo vía faucet.circle.com primero." };
  }

  const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
  const funding = await fundVaultFromTreasury({
    treasurySecret,
    vaultContractId: company.vaultContractId,
    amountUsdc,
  });

  revalidatePath("/dashboard", "layout");

  if (!funding.success) {
    return { error: `El fondeo falló: ${funding.error}` };
  }
  return { message: `Vault fondeado con ${amountUsdc} USDC adicionales.` };
}

/**
 * Da de alta a un empleado puntual en el vault ya inicializado — se invoca
 * desde createEmployee (src/app/actions/employee.ts) cuando el vault ya
 * existe, para que ningún empleado nuevo quede fuera del registro on-chain.
 */
export async function registerEmployeeInVaultIfActive(params: {
  companyId: string;
  employeeId: string;
  employeeWalletPublicKey: string;
}): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: params.companyId } });
  if (!company?.vaultInitialized || !company.vaultContractId) return;

  const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
  const registered = await registerVaultEmployee({
    contractId: company.vaultContractId,
    adminSecret: treasurySecret,
    employeePublicKey: params.employeeWalletPublicKey,
    limitUsdc: DEFAULT_EMPLOYEE_LIMIT_USDC,
  });
  if (registered.success) {
    await prisma.employee.update({
      where: { id: params.employeeId },
      data: { vaultRegistered: true, vaultLimit: DEFAULT_EMPLOYEE_LIMIT_USDC },
    });
  }
}
