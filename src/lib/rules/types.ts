export interface RuleCheckResult {
  /** Identificador estable de la regla, p.ej. "amount_within_limit". */
  rule: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface RuleEvaluationResult {
  /** true si el gasto coincide con una categoría definida en la política. */
  categoryMatched: boolean;
  checks: RuleCheckResult[];
  allPassed: boolean;
}
