import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const EVALUATED_STATUSES = ["APPROVED", "REJECTED", "REVIEW_REQUIRED"];

/**
 * Carga la empresa con sus relaciones, memoizada por request (React `cache`)
 * — el layout y cada página bajo /dashboard la llaman por separado, pero
 * dentro de un mismo request solo golpea la base de datos una vez.
 */
export const getCompany = cache(async function getCompany() {
  return prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      employees: { orderBy: { createdAt: "asc" } },
      policy: true,
      expenses: { orderBy: { createdAt: "desc" }, include: { employee: true } },
    },
  });
});

export type CompanyWithRelations = NonNullable<Awaited<ReturnType<typeof getCompany>>>;
