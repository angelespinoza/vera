import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "./types";

/**
 * Confidence gate — Etapa 6 / Módulo 7. Umbrales de ejemplo del concepto
 * original (docs/CFO_Agent_Concepto_v1.md §6); pendientes de calibrar con
 * datos reales (ver docs/ALCANCE_MVP.md §4.2).
 *
 * APPROVE_REVIEW_THRESHOLD recalibrado de 0.1 a 0.25 tras la demo de carga
 * masiva: con 0.1 casi ningún gasto limpio auto-aprobaba (Jev rara vez baja
 * de ~15-20% de "requiere revisión" aunque el cumplimiento sea alto), lo que
 * anulaba el valor de la automatización. Mismo valor duplicado a propósito
 * en src/lib/shadow/evaluate.ts para que la comparación Jev vs. LLM siga
 * siendo pareja.
 */
const APPROVE_COMPLIANCE_THRESHOLD = 0.95;
const APPROVE_REVIEW_THRESHOLD = 0.25;
const ESCALATE_COMPLIANCE_THRESHOLD = 0.7;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Orquesta reglas determinísticas + Jev en una decisión final.
 * AI recommends. Policy decides. — este motor nunca mueve fondos, solo decide.
 */
export function decideExpense(
  rules: RuleEvaluationResult,
  jev: (JevEvaluationResult & { error?: string }) | null,
): DecisionResult {
  const decidedAt = new Date().toISOString();

  if (!rules.allPassed) {
    const failed = rules.checks.filter((c) => !c.passed).map((c) => c.label);
    return {
      outcome: "REJECTED",
      reason: `Reglas determinísticas no cumplidas (${failed.join("; ")}). Se requiere corregir el gasto y volver a presentarlo.`,
      complianceConfidence: null,
      requiresReviewScore: null,
      hardRulesPassed: false,
      decidedAt,
    };
  }

  if (!jev || jev.error) {
    return {
      outcome: "REVIEW_REQUIRED",
      reason: jev?.error
        ? `Las reglas determinísticas pasaron, pero Jev no pudo evaluarse (${jev.error}). Se escala a revisión humana.`
        : "Las reglas determinísticas pasaron, pero no hay evaluación semántica disponible. Se escala a revisión humana.",
      complianceConfidence: null,
      requiresReviewScore: null,
      hardRulesPassed: true,
      decidedAt,
    };
  }

  const compliance = jev.compliesWithPolicy.probability;
  const review = jev.requiresReview.probability;

  if (compliance >= APPROVE_COMPLIANCE_THRESHOLD && review <= APPROVE_REVIEW_THRESHOLD) {
    return {
      outcome: "APPROVED",
      reason: `Reglas cumplidas y alta confianza de Jev en el cumplimiento de política (${pct(compliance)}), baja necesidad de revisión (${pct(review)}).`,
      complianceConfidence: compliance,
      requiresReviewScore: review,
      hardRulesPassed: true,
      decidedAt,
    };
  }

  if (compliance >= ESCALATE_COMPLIANCE_THRESHOLD) {
    return {
      outcome: "REVIEW_REQUIRED",
      reason: `Confianza de cumplimiento moderada (${pct(compliance)}) o necesidad de revisión elevada (${pct(review)}) — se escala a revisión humana.`,
      complianceConfidence: compliance,
      requiresReviewScore: review,
      hardRulesPassed: true,
      decidedAt,
    };
  }

  return {
    outcome: "REJECTED",
    reason: `Baja confianza de Jev en el cumplimiento de política (${pct(compliance)}). Se rechaza o se solicita más evidencia.`,
    complianceConfidence: compliance,
    requiresReviewScore: review,
    hardRulesPassed: true,
    decidedAt,
  };
}
