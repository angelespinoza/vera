import { getLlmProvider } from "@/lib/llm";
import type { PolicyCategoryRule } from "@/lib/policy/types";
import type { ShadowEvaluationResult, ShadowOutcome } from "./types";

/**
 * Panel comparativo Jev vs. LLM genérico — Etapa 7 / Módulo 10.
 *
 * RESTRICCIÓN DE SEGURIDAD NO NEGOCIABLE: esta vía es puramente informativa,
 * para medir velocidad y acierto frente a Jev. Bajo ninguna circunstancia
 * debe usarse para aprobar un gasto ni conectarse al módulo de pago
 * (src/app/actions/expense.ts la llama por separado de decideExpense, y
 * src/lib/decision nunca importa este módulo).
 */

// Mismos umbrales que src/lib/decision/engine.ts, duplicados a propósito:
// esta vía debe poder evolucionar (o eliminarse) sin tocar el motor real.
// Mantenidos en sync manualmente tras la recalibración (ver ese archivo).
const APPROVE_COMPLIANCE_THRESHOLD = 0.95;
const APPROVE_REVIEW_THRESHOLD = 0.25;
const ESCALATE_COMPLIANCE_THRESHOLD = 0.7;

function deriveOutcome(compliance: number, review: number): ShadowOutcome {
  if (compliance >= APPROVE_COMPLIANCE_THRESHOLD && review <= APPROVE_REVIEW_THRESHOLD) {
    return "APPROVED";
  }
  if (compliance >= ESCALATE_COMPLIANCE_THRESHOLD) {
    return "REVIEW_REQUIRED";
  }
  return "REJECTED";
}

export interface ShadowExpenseInput {
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  expenseDate: string;
  justification: string;
  employeeName: string;
  employeeRole: string;
  categoryRule?: PolicyCategoryRule;
}

interface ShadowJudgment {
  complies_with_policy: number;
  business_purpose_valid: number;
  evidence_sufficient: number;
  requires_review: number;
  role_relevant?: number;
}

const SYSTEM_INSTRUCTION = `Eres un evaluador de cumplimiento de gastos corporativos. Dado el estado de un
gasto (comercio, monto, categoría, justificación) y su política de gastos, responde con probabilidades
de 0 a 1 (no 0-100) para cada pregunta:
- complies_with_policy: ¿el gasto cumple con la política de gastos de la empresa?
- business_purpose_valid: ¿la justificación describe un propósito de negocio legítimo y creíble?
- evidence_sufficient: ¿el comprobante es consistente y suficiente para respaldar la justificación?
- requires_review: ¿el gasto presenta una señal concreta de riesgo real (posible fraude, gasto personal
  disfrazado de negocio, inconsistencia clara entre los datos, o un patrón atípico) que justifique
  detener el pago para revisión humana — más allá de la brevedad normal de una justificación cotidiana?
- role_relevant (solo si se pide): ¿el gasto es relevante para el rol del empleado?
Responde solo con las probabilidades, sin explicación.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["complies_with_policy", "business_purpose_valid", "evidence_sufficient", "requires_review"],
  properties: {
    complies_with_policy: { type: "number" },
    business_purpose_valid: { type: "number" },
    evidence_sufficient: { type: "number" },
    requires_review: { type: "number" },
    role_relevant: { type: "number" },
  },
} as const;

/** Evalúa el mismo gasto con el proveedor LLM genérico activo, para comparar contra Jev. */
export async function evaluateExpenseShadow(input: ShadowExpenseInput): Promise<ShadowEvaluationResult> {
  const provider = getLlmProvider();

  const prompt = JSON.stringify({
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
    ask_role_relevant: !!input.categoryRule?.requiresRoleRelevance,
  });

  const result = await provider.generateStructured<ShadowJudgment>({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    schemaName: "shadow_judgment",
    schema: SCHEMA,
  });

  const { compliesWithPolicy, businessPurposeValid, evidenceSufficient, requiresReview, roleRelevant } = {
    compliesWithPolicy: result.data.complies_with_policy,
    businessPurposeValid: result.data.business_purpose_valid,
    evidenceSufficient: result.data.evidence_sufficient,
    requiresReview: result.data.requires_review,
    roleRelevant: input.categoryRule?.requiresRoleRelevance ? result.data.role_relevant : undefined,
  };

  return {
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    compliesWithPolicy,
    businessPurposeValid,
    evidenceSufficient,
    requiresReview,
    roleRelevant,
    outcome: deriveOutcome(compliesWithPolicy, requiresReview),
  };
}
