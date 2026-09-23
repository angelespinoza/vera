"use client";

import { useActionState } from "react";
import { generatePolicy } from "@/app/actions/policy";
import type { ActionState } from "@/app/actions/company";

const initialState: ActionState = {};

export function PolicyForm({
  companyId,
  defaultText,
}: {
  companyId: string;
  defaultText?: string;
}) {
  const [state, formAction, pending] = useActionState(generatePolicy, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <label htmlFor="rawText" className="text-sm font-medium">
        Política de gastos (lenguaje natural)
      </label>
      <textarea
        id="rawText"
        name="rawText"
        required
        rows={6}
        defaultValue={defaultText}
        placeholder="Meals up to $50 per day. Hotels up to $180 per night during approved trips. Software up to $300 annually when relevant to the employee's role. Alcohol is not reimbursable."
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Generando política…" : defaultText ? "Regenerar política" : "Generar política"}
      </button>
    </form>
  );
}
