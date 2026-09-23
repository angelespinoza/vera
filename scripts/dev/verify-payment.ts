import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { sendUsdcPayment } from "../../src/lib/stellar/index.ts";
import { decryptSecret } from "../../src/lib/crypto.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const company = await prisma.company.findFirst({ include: { employees: true } });
if (!company || company.employees.length === 0) throw new Error("Falta company/employee de prueba");

const treasurySecret = decryptSecret(company.treasurySecretKeyEncrypted);
const employee = company.employees[0];

console.log("Intentando pagar 1 USDC desde treasury (balance actual: 0 USDC esperado)...");
const result = await sendUsdcPayment(treasurySecret, employee.walletPublicKey, 1);
console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
