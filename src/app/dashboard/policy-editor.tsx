"use client";

import { useActionState } from "react";
import { updatePolicyStructured } from "@/app/actions/policy";
import type { ActionState } from "@/app/actions/company";
import type { StructuredPolicy } from "@/lib/policy/types";

const initialState: ActionState = {};

export function PolicyEditor({
  companyId,
  structured,
}: {
  companyId: string;
  structured: StructuredPolicy;
}) {
  const [state, formAction, pending] = useActionState(updatePolicyStructured, initialState);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Categorías detectadas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-text-secondary">
                <th className="py-1 pr-4">Categoría</th>
                <th className="py-1 pr-4">Máximo</th>
                <th className="py-1 pr-4">Periodo</th>
                <th className="py-1 pr-4">Recibo desde</th>
                <th className="py-1 pr-4">Viaje aprobado</th>
                <th className="py-1 pr-4">Aprob. gerente</th>
                <th className="py-1 pr-4">Relevancia rol</th>
                <th className="py-1">No permitido</th>
              </tr>
            </thead>
            <tbody>
              {structured.categories.map((c) => (
                <tr key={c.category} className="border-b border-border-subtle">
                  <td className="py-1 pr-4">{c.label}</td>
                  <td className="py-1 pr-4">
                    {c.maxAmount !== undefined ? `${c.maxAmount} ${structured.currency}` : "—"}
                  </td>
                  <td className="py-1 pr-4">{c.maxAmountPeriod ?? "—"}</td>
                  <td className="py-1 pr-4">
                    {c.receiptRequiredAboveAmount !== undefined
                      ? `${c.receiptRequiredAboveAmount} ${structured.currency}`
                      : "—"}
                  </td>
                  <td className="py-1 pr-4">{c.requiresApprovedTrip ? "Sí" : "—"}</td>
                  <td className="py-1 pr-4">{c.requiresManagerApproval ? "Sí" : "—"}</td>
                  <td className="py-1 pr-4">{c.requiresRoleRelevance ? "Sí" : "—"}</td>
                  <td className="py-1">{c.disallowedItems?.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Editar estructura (JSON)</summary>
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="companyId" value={companyId} />
          <textarea
            name="structuredJson"
            rows={16}
            defaultValue={JSON.stringify(structured, null, 2)}
            className="rounded border border-border-subtle px-3 py-2 font-mono text-xs bg-surface-card"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar cambios manuales"}
          </button>
        </form>
      </details>
    </div>
  );
}
