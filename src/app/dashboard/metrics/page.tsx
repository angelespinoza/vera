import { getCompany, EVALUATED_STATUSES } from "../data";
import { Card, StatTile } from "../ui";
import { IconExpenses, IconMetrics, IconTreasury } from "../icons";
import type { DecisionResult } from "@/lib/decision/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const company = await getCompany();
  if (!company) return null;

  const evaluated = company.expenses.filter((e) => EVALUATED_STATUSES.includes(e.status));

  if (evaluated.length === 0) {
    return (
      <Card title="Métricas">
        <p className="text-sm text-text-secondary">Aún no hay gastos evaluados.</p>
      </Card>
    );
  }

  // --- Métricas para la demo (docs/CFO_Agent_Concepto_v1.md §17) ---
  const rulesOnly = evaluated.filter((e) => {
    const d = e.decision as unknown as DecisionResult | null;
    return d && !d.hardRulesPassed;
  });
  const jevDecided = evaluated.filter((e) => {
    const d = e.decision as unknown as DecisionResult | null;
    return d && d.hardRulesPassed;
  });
  const escalated = evaluated.filter((e) => e.status === "REVIEW_REQUIRED");
  const withJevLatency = evaluated.filter((e) => {
    const j = e.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
    return j && !j.error && typeof j.latencyMs === "number";
  });
  const avgJevLatency = withJevLatency.length
    ? Math.round(
        withJevLatency.reduce(
          (acc, e) => acc + (e.jevResults as unknown as JevEvaluationResult).latencyMs,
          0,
        ) / withJevLatency.length,
      )
    : null;
  const paid = evaluated.filter((e) => e.paymentTxHash);
  const usdcSettled = paid.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const pct = (n: number) => (evaluated.length ? Math.round((n / evaluated.length) * 100) : 0);

  // --- Panel comparativo Jev vs. LLM genérico (Etapa 7) ---
  const withBoth = evaluated.filter((e) => {
    const j = e.jevResults as unknown as (JevEvaluationResult & { error?: string }) | null;
    const s = e.shadowResults as unknown as (ShadowEvaluationResult & { error?: string }) | null;
    return j && !j.error && s && !s.error;
  });
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const jevAvgLatencyComparative = withBoth.length
    ? avg(withBoth.map((e) => (e.jevResults as unknown as JevEvaluationResult).latencyMs))
    : null;
  const shadowAvgLatency = withBoth.length
    ? avg(withBoth.map((e) => (e.shadowResults as unknown as ShadowEvaluationResult).latencyMs))
    : null;
  const agreements = withBoth.filter((e) => {
    const decision = e.decision as unknown as DecisionResult | null;
    const shadow = e.shadowResults as unknown as ShadowEvaluationResult;
    return decision && decision.outcome === shadow.outcome;
  }).length;

  return (
    <Card title="Métricas">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={<IconExpenses />} label="Gastos procesados" value={String(evaluated.length)} />
        <StatTile label="Solo reglas" value={String(rulesOnly.length)} hint={`${pct(rulesOnly.length)}%`} />
        <StatTile label="Resuelto con Jev" value={String(jevDecided.length)} hint={`${pct(jevDecided.length)}%`} />
        <StatTile
          label="Escalado a revisión"
          value={String(escalated.length)}
          hint={`${pct(escalated.length)}%`}
        />
        <StatTile
          icon={<IconMetrics />}
          label="Latencia prom. Jev"
          value={avgJevLatency !== null ? `${avgJevLatency}ms` : "—"}
        />
        <StatTile
          icon={<IconTreasury />}
          label="USDC liquidado"
          value={usdcSettled.toFixed(2)}
          hint={`${paid.length} pago${paid.length === 1 ? "" : "s"}`}
        />
      </div>
      {withBoth.length > 0 && (
        <p className="rounded-lg border border-border-subtle bg-surface-muted p-3 text-xs text-text-secondary">
          Panel comparativo Jev vs. LLM genérico ({withBoth.length} gasto
          {withBoth.length === 1 ? "" : "s"}): latencia promedio Jev <strong>{jevAvgLatencyComparative}ms</strong>{" "}
          vs. LLM genérico <strong>{shadowAvgLatency}ms</strong> — coinciden en el veredicto{" "}
          <strong>
            {agreements}/{withBoth.length}
          </strong>
          .
        </p>
      )}
    </Card>
  );
}
