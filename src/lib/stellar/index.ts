import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  TransactionFailedError,
} from "@stellar/stellar-sdk";

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

// Issuer oficial de USDC de Circle en Stellar testnet (verificado en Circle Docs y Stellar Expert).
export const USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const USDC_TESTNET_ASSET = new Asset("USDC", USDC_TESTNET_ISSUER);

export function getHorizonServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

export interface CustodialWallet {
  publicKey: string;
  secretKey: string;
}

/**
 * Genera una wallet nueva, la fondea con Friendbot (XLM testnet) y establece
 * el trustline a USDC testnet. Uso: crear treasury de empresa o wallet de
 * empleado (Módulos 1 y 2). Solo funciona en testnet (Friendbot no existe en
 * mainnet).
 */
export async function createFundedTestWallet(): Promise<CustodialWallet> {
  const server = getHorizonServer();
  const keypair = Keypair.random();

  await server.friendbot(keypair.publicKey()).call();

  const account = await server.loadAccount(keypair.publicKey());
  const trustTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC_TESTNET_ASSET }))
    .setTimeout(30)
    .build();
  trustTx.sign(keypair);
  await server.submitTransaction(trustTx);

  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

export interface AccountBalances {
  xlm: string;
  usdc: string;
}

/** Lee los balances actuales (XLM y USDC) de una cuenta testnet. */
export async function getAccountBalances(publicKey: string): Promise<AccountBalances> {
  const server = getHorizonServer();
  const account = await server.loadAccount(publicKey);

  let xlm = "0";
  let usdc = "0";
  for (const balance of account.balances) {
    if (balance.asset_type === "native") {
      xlm = balance.balance;
    } else if (
      "asset_code" in balance &&
      balance.asset_code === "USDC" &&
      "asset_issuer" in balance &&
      balance.asset_issuer === USDC_TESTNET_ISSUER
    ) {
      usdc = balance.balance;
    }
  }
  return { xlm, usdc };
}

export function stellarExpertAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

export function stellarExpertTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export interface PaymentResult {
  success: boolean;
  hash?: string;
  error?: string;
}

const HORIZON_ERROR_LABELS: Record<string, string> = {
  op_underfunded: "Balance insuficiente en la treasury",
  op_no_destination: "La cuenta destino no existe en Stellar testnet",
  op_no_trust: "La cuenta destino no tiene trustline a USDC",
  op_line_full: "La cuenta destino no puede recibir más USDC (línea llena)",
  tx_insufficient_balance: "Balance insuficiente para cubrir el pago y la comisión",
  tx_bad_seq: "Número de secuencia inválido (reintentar)",
};

/**
 * Cola global que serializa los envíos: `loadAccount` trae el número de
 * secuencia vigente y cada pago lo incrementa en 1, pero Horizon solo lo
 * refleja hasta que el ledger cierra (~5s). Si dos pagos del mismo treasury
 * se dispararan en paralelo, ambos leerían la misma secuencia y el segundo
 * fallaría con tx_bad_seq. Desde que la carga masiva paraleliza el análisis
 * (reglas + Jev + LLM), esta cola es la que evita esa condición de carrera —
 * el análisis sí corre concurrente, el envío nunca.
 */
let paymentQueue: Promise<PaymentResult> = Promise.resolve({ success: true });

/**
 * Envía USDC testnet desde una wallet (secret key en claro, ya descifrada
 * por el caller) a una wallet destino. Etapa 8 / Módulo 8 — se invoca solo
 * cuando el motor de decisión (Etapa 6) aprueba el gasto.
 */
export function sendUsdcPayment(fromSecretKey: string, toPublicKey: string, amount: number): Promise<PaymentResult> {
  const task = paymentQueue.then(() => doSendUsdcPayment(fromSecretKey, toPublicKey, amount));
  paymentQueue = task;
  return task;
}

async function doSendUsdcPayment(
  fromSecretKey: string,
  toPublicKey: string,
  amount: number,
): Promise<PaymentResult> {
  const server = getHorizonServer();
  try {
    const keypair = Keypair.fromSecret(fromSecretKey);
    const account = await server.loadAccount(keypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: toPublicKey,
          asset: USDC_TESTNET_ASSET,
          amount: amount.toFixed(7),
        }),
      )
      .setTimeout(30)
      .build();
    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    return { success: true, hash: result.hash };
  } catch (err) {
    if (err instanceof TransactionFailedError) {
      const { operations } = err.getResultCodes();
      const label = operations.map((code) => HORIZON_ERROR_LABELS[code] ?? code).join("; ");
      return { success: false, error: label || err.message };
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
