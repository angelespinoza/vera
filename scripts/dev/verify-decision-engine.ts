import { decideExpense } from "../../src/lib/decision/engine.ts";
import type { RuleEvaluationResult } from "../../src/lib/rules/types.ts";

const passingRules: RuleEvaluationResult = {
  categoryMatched: true,
  allPassed: true,
  checks: [{ rule: "x", label: "x", passed: true, detail: "ok" }],
};

const failingRules: RuleEvaluationResult = {
  categoryMatched: true,
  allPassed: false,
  checks: [{ rule: "amount_within_limit", label: "Monto dentro del límite", passed: false, detail: "excede" }],
};

console.log(
  "Alta confianza + baja necesidad de revisión ->",
  decideExpense(passingRules, {
    compliesWithPolicy: { probability: 0.98 },
    businessPurposeValid: { probability: 0.96 },
    evidenceSufficient: { probability: 0.97 },
    requiresReview: { probability: 0.03 },
    model: "jev-test",
  }).outcome,
);

console.log(
  "Reglas duras fallidas ->",
  decideExpense(failingRules, {
    compliesWithPolicy: { probability: 0.9 },
    businessPurposeValid: { probability: 0.9 },
    evidenceSufficient: { probability: 0.9 },
    requiresReview: { probability: 0.1 },
    model: "jev-test",
  }).outcome,
);

console.log(
  "Baja confianza ->",
  decideExpense(passingRules, {
    compliesWithPolicy: { probability: 0.3 },
    businessPurposeValid: { probability: 0.2 },
    evidenceSufficient: { probability: 0.3 },
    requiresReview: { probability: 0.8 },
    model: "jev-test",
  }).outcome,
);
