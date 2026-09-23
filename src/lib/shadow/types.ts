export type ShadowOutcome = "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";

export interface ShadowEvaluationResult {
  provider: "openai" | "gemini";
  model: string;
  /** Latencia de la llamada, para comparar contra Jev (Etapa 7 / Módulo 10). */
  latencyMs: number;
  compliesWithPolicy: number;
  businessPurposeValid: number;
  evidenceSufficient: number;
  requiresReview: number;
  /** Solo presente si la categoría exige relevancia de rol. */
  roleRelevant?: number;
  /**
   * Veredicto derivado con el mismo umbral que el motor de decisión real,
   * PURAMENTE INFORMATIVO — esta vía nunca autoriza pagos (ver Módulo 8/10).
   */
  outcome: ShadowOutcome;
}
