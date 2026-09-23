import { getAccountBalances } from "../../src/lib/stellar/index.ts";

const publicKey = process.argv[2];
if (!publicKey) {
  console.error("Uso: check-balance.ts <publicKey>");
  process.exit(1);
}
console.log(await getAccountBalances(publicKey));
