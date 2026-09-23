import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const p = await prisma.policy.findFirst();
console.log(JSON.stringify(p, null, 2));
await prisma.$disconnect();
