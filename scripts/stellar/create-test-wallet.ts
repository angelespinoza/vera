/**
 * Etapa 0 — prueba de fundaciones Stellar.
 * Genera un keypair de testnet, lo fondea con Friendbot (XLM) y establece
 * un trustline a USDC de Circle en testnet. No requiere credenciales.
 *
 * Uso: node scripts/stellar/create-test-wallet.ts
 */
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";
// Issuer oficial de USDC de Circle en Stellar testnet (verificado en Circle Docs y Stellar Expert).
const USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

async function main() {
  const server = new Horizon.Server(HORIZON_TESTNET_URL);
  const keypair = Keypair.random();

  console.log("Wallet generada:");
  console.log("  Public Key :", keypair.publicKey());
  console.log("  Secret Key :", keypair.secret());

  console.log("\nFondeando con Friendbot (XLM testnet)...");
  await server.friendbot(keypair.publicKey()).call();

  const account = await server.loadAccount(keypair.publicKey());
  const xlmBalance = account.balances.find((b) => b.asset_type === "native");
  console.log("  XLM balance:", xlmBalance?.balance);

  console.log("\nEstableciendo trustline a USDC (testnet)...");
  const usdc = new Asset("USDC", USDC_TESTNET_ISSUER);
  const trustTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(30)
    .build();
  trustTx.sign(keypair);
  const trustResult = await server.submitTransaction(trustTx);
  console.log("  Trustline tx hash:", trustResult.hash);

  const updatedAccount = await server.loadAccount(keypair.publicKey());
  console.log("\nBalances finales:");
  for (const balance of updatedAccount.balances) {
    if (balance.asset_type === "native") {
      console.log(`  XLM: ${balance.balance}`);
    } else if ("asset_code" in balance) {
      console.log(`  ${balance.asset_code}: ${balance.balance}`);
    }
  }

  console.log(
    `\nVer en Stellar Expert: https://stellar.expert/explorer/testnet/account/${keypair.publicKey()}`,
  );
}

main().catch((err) => {
  console.error("Error:", err?.response?.data ?? err);
  process.exit(1);
});
