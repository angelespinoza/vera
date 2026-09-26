import { Keypair, Networks } from "@stellar/stellar-sdk";
import { Client, type AssembledTransaction, type MethodOptions } from "@stellar/stellar-sdk/contract";

// No generamos bindings TS con `stellar contract bindings typescript` — estas
// interfaces solo describen, para el compilador, los métodos que `Client.from`
// arma en tiempo de ejecución a partir del spec on-chain del contrato (ver
// contracts/spending-vault/src/lib.rs para la fuente de verdad real).
interface SpendingVaultContract {
  initialize: (
    args: { admin: string; operator: string; token: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
  set_operator: (
    args: { new_operator: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
  register_employee: (
    args: { employee: string; limit: bigint },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
  release_payment: (
    args: { employee: string; amount: bigint },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
  balance: (options?: MethodOptions) => Promise<AssembledTransaction<bigint>>;
  get_cap: (
    args: { employee: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<{ limit: bigint; spent: bigint } | undefined>>;
}

interface SacTokenContract {
  transfer: (
    args: { from: string; to: string; amount: bigint },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
}

const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

// SAC de USDC en Stellar testnet (mismo asset que USDC_TESTNET_ASSET en
// src/lib/stellar/index.ts, pero como contrato — necesario porque
// SpendingVault paga vía `token::Client::transfer`, la interfaz Soroban del
// asset, no vía Operation.payment clásico).
export const USDC_TESTNET_SAC_ID =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

export interface VaultResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// USDC tiene 7 decimales tanto en el asset clásico como en el SAC — mismo
// factor que amount.toFixed(7) usa en el pago clásico (src/lib/stellar/index.ts).
const USDC_UNIT = BigInt(10) ** BigInt(7);

function toStroops(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * Number(USDC_UNIT)));
}

function fromStroops(units: bigint): number {
  return Number(units) / Number(USDC_UNIT);
}

function clientFor<T>(contractId: string, signer?: Keypair) {
  return Client.from<T>({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: signer?.publicKey(),
    signTransaction: signer,
  });
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Se llama una sola vez por vault, justo después de desplegar el contrato
 * (ver contracts/spending-vault). `admin` gobierna altas de empleados y
 * rotación del operador; nunca se usa para pagar día a día.
 */
export async function initializeVault(params: {
  contractId: string;
  adminSecret: string;
  operatorPublicKey: string;
  tokenContractId: string;
}): Promise<VaultResult> {
  try {
    const admin = Keypair.fromSecret(params.adminSecret);
    const client = await clientFor<SpendingVaultContract>(params.contractId, admin);
    const tx = await client.initialize({
      admin: admin.publicKey(),
      operator: params.operatorPublicKey,
      token: params.tokenContractId,
    });
    const sent = await tx.signAndSend();
    return { success: true, hash: sent.sendTransactionResponse?.hash };
  } catch (err) {
    return { success: false, error: describeError(err) };
  }
}

/**
 * Rota la llave operadora sin tocar los topes ya registrados. Existe para el
 * caso de recuperación: si `initialize` se ejecutó on-chain pero el proceso
 * murió antes de persistir la llave operadora generada (p. ej. un crash del
 * servidor justo después), esta llamada — firmada por el mismo admin —
 * permite registrar una operadora nueva sin perder el vault ya inicializado.
 */
export async function setVaultOperator(params: {
  contractId: string;
  adminSecret: string;
  newOperatorPublicKey: string;
}): Promise<VaultResult> {
  try {
    const admin = Keypair.fromSecret(params.adminSecret);
    const client = await clientFor<SpendingVaultContract>(params.contractId, admin);
    const tx = await client.set_operator({ new_operator: params.newOperatorPublicKey });
    const sent = await tx.signAndSend();
    return { success: true, hash: sent.sendTransactionResponse?.hash };
  } catch (err) {
    return { success: false, error: describeError(err) };
  }
}

/**
 * Da de alta (o actualiza el tope de) una wallet de empleado en el vault.
 * Requiere la llave admin — el operador nunca puede hacer esto por su cuenta.
 */
export async function registerVaultEmployee(params: {
  contractId: string;
  adminSecret: string;
  employeePublicKey: string;
  limitUsdc: number;
}): Promise<VaultResult> {
  try {
    const admin = Keypair.fromSecret(params.adminSecret);
    const client = await clientFor<SpendingVaultContract>(params.contractId, admin);
    const tx = await client.register_employee({
      employee: params.employeePublicKey,
      limit: toStroops(params.limitUsdc),
    });
    const sent = await tx.signAndSend();
    return { success: true, hash: sent.sendTransactionResponse?.hash };
  } catch (err) {
    return { success: false, error: describeError(err) };
  }
}

/**
 * Cola global que serializa las llamadas a `release_payment`: igual que
 * `sendUsdcPayment` en src/lib/stellar/index.ts, dos invocaciones firmadas
 * por la misma cuenta operadora en paralelo leerían el mismo número de
 * secuencia y la segunda fallaría. La carga masiva analiza gastos en
 * paralelo pero el pago (clásico o vault) siempre se serializa.
 */
let vaultPaymentQueue: Promise<VaultResult> = Promise.resolve({ success: true });

/**
 * El único camino para que salga dinero del vault (Módulo 8 on-chain).
 * Firma con la llave operadora, no con el treasury/admin — si esta llave se
 * filtra, el daño máximo es "gastar hasta el límite de cada empleado
 * registrado", nunca vaciar el vault ni pagar a una wallet no registrada.
 */
export function releaseVaultPayment(params: {
  contractId: string;
  operatorSecret: string;
  employeePublicKey: string;
  amountUsdc: number;
}): Promise<VaultResult> {
  const task = vaultPaymentQueue.then(() => doReleaseVaultPayment(params));
  vaultPaymentQueue = task;
  return task;
}

async function doReleaseVaultPayment(params: {
  contractId: string;
  operatorSecret: string;
  employeePublicKey: string;
  amountUsdc: number;
}): Promise<VaultResult> {
  try {
    const operator = Keypair.fromSecret(params.operatorSecret);
    const client = await clientFor<SpendingVaultContract>(params.contractId, operator);
    const tx = await client.release_payment({
      employee: params.employeePublicKey,
      amount: toStroops(params.amountUsdc),
    });
    const sent = await tx.signAndSend();
    return { success: true, hash: sent.sendTransactionResponse?.hash };
  } catch (err) {
    return { success: false, error: describeError(err) };
  }
}

/**
 * Fondea el vault transfiriendo USDC desde el treasury hacia la dirección
 * del contrato. A diferencia de un pago clásico (Operation.payment, que solo
 * acepta cuentas G...), esto invoca `transfer` en el SAC de USDC porque el
 * destino es una dirección de contrato (C...).
 */
export async function fundVaultFromTreasury(params: {
  treasurySecret: string;
  vaultContractId: string;
  amountUsdc: number;
}): Promise<VaultResult> {
  try {
    const treasury = Keypair.fromSecret(params.treasurySecret);
    const client = await clientFor<SacTokenContract>(USDC_TESTNET_SAC_ID, treasury);
    const tx = await client.transfer({
      from: treasury.publicKey(),
      to: params.vaultContractId,
      amount: toStroops(params.amountUsdc),
    });
    const sent = await tx.signAndSend();
    return { success: true, hash: sent.sendTransactionResponse?.hash };
  } catch (err) {
    return { success: false, error: describeError(err) };
  }
}

/** Balance actual del vault en USDC (lectura, no requiere firma). */
export async function getVaultBalanceUsdc(contractId: string): Promise<number> {
  const client = await clientFor<SpendingVaultContract>(contractId);
  const tx = await client.balance();
  return fromStroops(tx.result);
}

/** Tope y gasto acumulado de un empleado en el vault, o `undefined` si no está registrado. */
export async function getVaultEmployeeCap(
  contractId: string,
  employeePublicKey: string,
): Promise<{ limitUsdc: number; spentUsdc: number } | undefined> {
  const client = await clientFor<SpendingVaultContract>(contractId);
  const tx = await client.get_cap({ employee: employeePublicKey });
  const cap = tx.result;
  if (!cap) return undefined;
  return { limitUsdc: fromStroops(cap.limit), spentUsdc: fromStroops(cap.spent) };
}
