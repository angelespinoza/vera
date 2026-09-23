import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import type { PolicyCategoryRule } from "@/lib/policy/types";
import type { JevEvaluationResult } from "./types";

export interface JevExpenseInput {
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  justification: string;
  employeeName: string;
  employeeRole: string;
  categoryRule?: PolicyCategoryRule;
}

let client: TypeSafeClient | undefined;
function getClient(): TypeSafeClient {
  if (!client) client = new TypeSafeClient();
  return client;
}

const COMPLIES_WITH_POLICY = noul(
  "Considerando la política de la categoría y los datos del gasto, ¿este gasto cumple con la política de gastos de la empresa?",
  {
    true: "El gasto respeta los límites y condiciones de la política",
    false: "El gasto viola o probablemente viola la política",
  },
);

const BUSINESS_PURPOSE_VALID = noul(
  "¿La justificación describe un propósito de negocio legítimo y creíble para este gasto?",
  {
    true: "La justificación explica una razón de negocio clara y verosímil",
    false: "La justificación es vaga, genérica o no relacionada con el negocio",
  },
);

const EVIDENCE_SUFFICIENT = noul(
  "¿El comprobante (comercio, monto, fecha) es consistente y suficiente para respaldar la justificación dada?",
  {
    true: "Los datos del comprobante respaldan la justificación",
    false: "Hay inconsistencias entre el comprobante y la justificación, o falta evidencia",
  },
);

const REQUIRES_REVIEW = noul(
  "¿Este gasto presenta alguna ambigüedad, riesgo o inconsistencia que amerite revisión humana antes de aprobarlo?",
  {
    true: "Hay motivo razonable para una revisión humana",
    false: "No hay señales de riesgo o ambigüedad",
  },
);

/** Evalúa un gasto con Jev (TypeSafe) — Etapa 5 / Módulo 6. No mueve fondos. */
export async function evaluateExpenseWithJev(input: JevExpenseInput): Promise<JevEvaluationResult> {
  const state = {
    expense: {
      merchant: input.merchant,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      date: input.expenseDate,
      justification: input.justification,
    },
    employee: { name: input.employeeName, role: input.employeeRole },
    policy_category: input.categoryRule ?? null,
  };
  // El SDK tipa `state` como JSON puro; PolicyCategoryRule es una interfaz sin
  // index signature, así que se normaliza a JSON plano.
  const normalizedState = JSON.parse(JSON.stringify(state));

  const client = getClient();
  const start = Date.now();

  if (input.categoryRule?.requiresRoleRelevance) {
    const { answers, model } = await client.systemOne({
      state: normalizedState,
      questions: {
        complies_with_policy: COMPLIES_WITH_POLICY,
        business_purpose_valid: BUSINESS_PURPOSE_VALID,
        evidence_sufficient: EVIDENCE_SUFFICIENT,
        requires_review: REQUIRES_REVIEW,
        role_relevant: noul(
          `¿Es este gasto relevante para el trabajo de un(a) ${input.employeeRole}?`,
          {
            true: "El gasto es claramente relevante para las funciones del rol",
            false: "El gasto no parece relacionado con las funciones del rol",
          },
        ),
      },
    });
    return {
      compliesWithPolicy: { probability: answers.complies_with_policy.noul },
      businessPurposeValid: { probability: answers.business_purpose_valid.noul },
      evidenceSufficient: { probability: answers.evidence_sufficient.noul },
      requiresReview: { probability: answers.requires_review.noul },
      roleRelevant: { probability: answers.role_relevant.noul },
      model,
      latencyMs: Date.now() - start,
    };
  }

  const { answers, model } = await client.systemOne({
    state: normalizedState,
    questions: {
      complies_with_policy: COMPLIES_WITH_POLICY,
      business_purpose_valid: BUSINESS_PURPOSE_VALID,
      evidence_sufficient: EVIDENCE_SUFFICIENT,
      requires_review: REQUIRES_REVIEW,
    },
  });
  return {
    compliesWithPolicy: { probability: answers.complies_with_policy.noul },
    businessPurposeValid: { probability: answers.business_purpose_valid.noul },
    evidenceSufficient: { probability: answers.evidence_sufficient.noul },
    requiresReview: { probability: answers.requires_review.noul },
    model,
    latencyMs: Date.now() - start,
  };
}
