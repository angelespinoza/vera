export interface JevSignal {
  /** Probabilidad de "sí", 0 a 1 (directo de Noul — sin campo de confianza separado). */
  probability: number;
}

export interface JevEvaluationResult {
  compliesWithPolicy: JevSignal;
  businessPurposeValid: JevSignal;
  evidenceSufficient: JevSignal;
  requiresReview: JevSignal;
  /** Solo presente si la categoría exige relevancia de rol (requiresRoleRelevance). */
  roleRelevant?: JevSignal;
  model: string;
}
