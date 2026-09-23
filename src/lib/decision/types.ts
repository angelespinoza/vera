export type DecisionOutcome = "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";

export interface DecisionResult {
  outcome: DecisionOutcome;
  reason: string;
  /** jev.compliesWithPolicy.probability, o null si no hubo evaluación de Jev. */
  complianceConfidence: number | null;
  /** jev.requiresReview.probability, o null si no hubo evaluación de Jev. */
  requiresReviewScore: number | null;
  hardRulesPassed: boolean;
  decidedAt: string;
}
