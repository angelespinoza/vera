import type { RuleEvaluationResult } from "@/lib/rules/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { DecisionResult } from "./types";

/**
 * Confidence gate — Etapa 6 / Módulo 7. Umbrales de ejemplo del concepto
 * original (docs/CFO_Agent_Concepto_v1.md §6); pendientes de calibrar con
 * datos reales (ver docs/ALCANCE_MVP.md §4.2).
 *
 * Segunda recalibración, basada en una medición de 58 gastos reales de
 * demo: incluso gastos genuinamente limpios (herramientas de software
 * plausibles para el rol, actividades de equipo con aprobación mencionada,
 * comidas de trabajo con justificación clara) tienen un techo estructural
 * de Jev alrededor de 85-94% de cumplimiento y 8-27% de necesidad de
 * revisión — Jev rara vez llega a una confianza "total" porque casi nunca
 * puede verificar por sí mismo evidencia externa (aprobación de manager,
 * relevancia de rol). Con el umbral anterior (95% / 25%) solo 3 de 58
 * gastos limpios auto-aprobaban. Bajado a 85% / 30% para que la automatización
 * tenga valor real; mismos valores duplicados a propósito en
 * src/lib/shadow/evaluate.ts para que la comparación Jev vs. LLM siga
 * siendo pareja.
 */
const APPROVE_COMPLIANCE_THRESHOLD = 0.85;
const APPROVE_REVIEW_THRESHOLD = 0.3;
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
