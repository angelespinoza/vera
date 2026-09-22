/**
 * Verificación manual de la lógica de negocio de Etapa 1, sin pasar por HTTP/UI.
 * (Usa imports relativos porque los alias "@/*" solo los resuelve el bundler de Next.js.)
 * Uso: node --env-file=.env scripts/dev/verify-etapa1.ts
 */
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createFundedTestWallet, getAccountBalances } from "../../src/lib/stellar/index.ts";
import { encryptSecret, decryptSecret } from "../../src/lib/crypto.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("1) Creando treasury wallet para la empresa...");
  const treasury = await createFundedTestWallet();
  console.log("   Treasury:", treasury.publicKey);

  const company = await prisma.company.create({
    data: {
      name: "Acme Remote Inc. (verify script)",
      cfoEmail: `cfo+${Date.now()}@acmeremote.test`,
      treasuryPublicKey: treasury.publicKey,
      treasurySecretKeyEncrypted: encryptSecret(treasury.secretKey),
    },
  });
  console.log("   Company creada en DB:", company.id);

  console.log("\n2) Creando empleado con wallet...");
  const wallet = await createFundedTestWallet();
  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Angel Espinoza",
      email: "angel@acmeremote.test",
      role: "Product Manager",
      walletPublicKey: wallet.publicKey,
      walletSecretKeyEncrypted: encryptSecret(wallet.secretKey),
    },
  });
  console.log("   Employee creado en DB:", employee.id, employee.walletPublicKey);

  console.log("\n3) Verificando cifrado/descifrado de secret keys...");
  const decryptedTreasury = decryptSecret(company.treasurySecretKeyEncrypted);
  const decryptedEmployee = decryptSecret(employee.walletSecretKeyEncrypted);
  console.log("   Treasury secret coincide:", decryptedTreasury === treasury.secretKey);
  console.log("   Employee secret coincide:", decryptedEmployee === wallet.secretKey);

  console.log("\n4) Leyendo balances en vivo desde Horizon...");
  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);
  const employeeBalances = await getAccountBalances(employee.walletPublicKey);
  console.log("   Treasury:", treasuryBalances);
  console.log("   Employee:", employeeBalances);

  console.log("\n5) Releyendo desde Prisma con relación include...");
  const fetched = await prisma.company.findUnique({
    where: { id: company.id },
    include: { employees: true },
  });
  console.log("   Company + employees:", JSON.stringify(fetched, null, 2));

  console.log("\nOK — Etapa 1 verificada de punta a punta.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
