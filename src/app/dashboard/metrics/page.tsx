import { getCompany, EVALUATED_STATUSES } from "../data";
import { Card, StatTile } from "../ui";
import { IconExpenses, IconMetrics, IconTreasury } from "../icons";
import { CategorySpendChart, OutcomeTrendChart, type CategorySeries, type CategoryWeek, type OutcomeWeek } from "../charts";
import type { DecisionResult } from "@/lib/decision/types";
import type { JevEvaluationResult } from "@/lib/jev/types";
import type { ShadowEvaluationResult } from "@/lib/shadow/types";

export const dynamic = "force-dynamic";

// Categorías reales de la política; cualquier otra (ej. datos de prueba con
// categorías no definidas) se agrupa en "Otros" en vez de diluir la gráfica.
const REAL_CATEGORIES = new Set(["meals", "hotels", "software", "entertainment"]);
const CATEGORY_META: Record<string, { label: string; colorVar: string }> = {
  meals: { label: "Meals", colorVar: "var(--accent)" },
  software: { label: "Software", colorVar: "var(--chart-cat-2)" },
  hotels: { label: "Hotels", colorVar: "var(--chart-cat-3)" },
  entertainment: { label: "Entertainment", colorVar: "var(--chart-cat-4)" },
  otros: { label: "Otros", colorVar: "var(--chart-cat-5)" },
};
const CATEGORY_ORDER = ["meals", "software", "hotels", "entertainment", "otros"];

/** Lunes de la semana ISO que contiene `d`, como clave ordenable YYYY-MM-DD. */
function weekKey(d: Date): string {
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
}

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

  // --- Gráficas: gasto por categoría y decisiones, agrupados por semana de
  // expenseDate (la fecha del gasto, no la de procesamiento) ---
  const categoryBuckets = new Map<string, Record<string, number>>();
  const outcomeBuckets = new Map<string, { approved: number; review: number; rejected: number }>();

  for (const e of evaluated) {
    if (!e.expenseDate) continue;
    const wk = weekKey(e.expenseDate);
    const catKey = REAL_CATEGORIES.has(e.category ?? "") ? (e.category as string) : "otros";

    const catBucket = categoryBuckets.get(wk) ?? {};
    catBucket[catKey] = (catBucket[catKey] ?? 0) + (e.amount ?? 0);
    categoryBuckets.set(wk, catBucket);

    const outBucket = outcomeBuckets.get(wk) ?? { approved: 0, review: 0, rejected: 0 };
    if (e.status === "APPROVED") outBucket.approved++;
    else if (e.status === "REVIEW_REQUIRED") outBucket.review++;
    else if (e.status === "REJECTED") outBucket.rejected++;
    outcomeBuckets.set(wk, outBucket);
  }

  const sortedWeeks = Array.from(categoryBuckets.keys()).sort();
  const categoryWeeks: CategoryWeek[] = sortedWeeks.map((wk) => ({
    label: weekLabel(wk),
    values: categoryBuckets.get(wk)!,
  }));
  const outcomeWeeks: OutcomeWeek[] = sortedWeeks.map((wk) => ({
    label: weekLabel(wk),
    ...(outcomeBuckets.get(wk) ?? { approved: 0, review: 0, rejected: 0 }),
  }));
  const categorySeries: CategorySeries[] = CATEGORY_ORDER.filter((k) =>
    categoryWeeks.some((w) => (w.values[k] ?? 0) > 0),
  ).map((k) => ({ key: k, ...CATEGORY_META[k] }));

  const today = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
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
        <p className="text-xs text-text-secondary">Actualizado: {today}</p>
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

      {(categoryWeeks.length > 1 || outcomeWeeks.length > 1) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {categoryWeeks.length > 1 && (
            <Card title="Gasto por categoría" badge={<span className="text-xs text-text-secondary">por semana</span>}>
              <CategorySpendChart weeks={categoryWeeks} categories={categorySeries} />
            </Card>
          )}

          {outcomeWeeks.length > 1 && (
            <Card
              title="Decisiones por semana"
              badge={<span className="text-xs text-text-secondary">Jev + reglas</span>}
            >
              <OutcomeTrendChart weeks={outcomeWeeks} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
