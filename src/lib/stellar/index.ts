import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
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
