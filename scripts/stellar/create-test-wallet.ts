/**
 * Etapa 0 — prueba de fundaciones Stellar.
 * Genera una wallet de testnet fondeada (Friendbot + trustline USDC) usando
 * el módulo compartido src/lib/stellar. No requiere credenciales.
 *
 * Uso: node scripts/stellar/create-test-wallet.ts
 */
import {
  createFundedTestWallet,
  getAccountBalances,
  stellarExpertAccountUrl,
} from "../../src/lib/stellar/index.ts";

async function main() {
  console.log("Generando y fondeando wallet de prueba...\n");
  const wallet = await createFundedTestWallet();

  console.log("Public Key :", wallet.publicKey);
  console.log("Secret Key :", wallet.secretKey);

  const balances = await getAccountBalances(wallet.publicKey);
  console.log("\nBalances:");
  console.log("  XLM :", balances.xlm);
  console.log("  USDC:", balances.usdc);

  console.log("\nVer en Stellar Expert:", stellarExpertAccountUrl(wallet.publicKey));
}

main().catch((err) => {
  console.error("Error:", err?.response?.data ?? err);
  process.exit(1);
});
