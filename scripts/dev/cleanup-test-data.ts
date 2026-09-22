import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const r = await prisma.company.deleteMany({
  where: { cfoEmail: { contains: "@acmeremote.test" } },
});
console.log("Borrados:", r.count);
await prisma.$disconnect();
