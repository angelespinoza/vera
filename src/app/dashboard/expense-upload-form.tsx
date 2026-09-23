"use client";

import { useActionState } from "react";
import { uploadExpenseReceipt } from "@/app/actions/expense";
import type { ActionState } from "@/app/actions/company";

const initialState: ActionState = {};

export function ExpenseUploadForm({
  companyId,
  employees,
}: {
  companyId: string;
  employees: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(uploadExpenseReceipt, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeId" className="text-sm font-medium">
          Empleado
        </label>
        <select
          id="employeeId"
          name="employeeId"
          required
          defaultValue=""
          className="rounded border border-border-subtle px-3 py-2 text-sm bg-surface-card"
        >
          <option value="" disabled>
            Selecciona un empleado
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="receipt" className="text-sm font-medium">
          Comprobante (imagen)
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required
          className="text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {pending ? "Extrayendo datos del comprobante…" : "Cargar comprobante"}
      </button>
    </form>
  );
}
