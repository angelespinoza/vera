"use client";

import { useActionState } from "react";
import { confirmExpense } from "@/app/actions/expense";
import type { ActionState } from "@/app/actions/company";

const initialState: ActionState = {};

export function ExpenseConfirmForm({
  expenseId,
  employeeName,
  receiptDataUrl,
  amount,
  currency,
  merchant,
  expenseDate,
  category,
  confidence,
}: {
  expenseId: string;
  employeeName: string;
  receiptDataUrl: string;
  amount?: number | null;
  currency?: string | null;
  merchant?: string | null;
  expenseDate?: string; // YYYY-MM-DD
  category?: string | null;
  confidence?: number;
}) {
  const [state, formAction, pending] = useActionState(confirmExpense, initialState);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 md:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={receiptDataUrl}
        alt="Comprobante"
        className="h-40 w-40 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
      />
      <form action={formAction} className="flex flex-1 flex-col gap-2">
        <input type="hidden" name="expenseId" value={expenseId} />
        <p className="text-sm text-zinc-500">
          {employeeName} — extracción con{" "}
          {confidence !== undefined ? `${Math.round(confidence * 100)}% de confianza` : "confianza desconocida"}
          . Revisa y corrige antes de confirmar.
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={amount ?? ""}
            placeholder="Monto"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="currency"
            required
            defaultValue={currency ?? "USD"}
            placeholder="Moneda"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="merchant"
            required
            defaultValue={merchant ?? ""}
            placeholder="Comercio"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="category"
            required
            defaultValue={category ?? ""}
            placeholder="Categoría"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="expenseDate"
            type="date"
            required
            defaultValue={expenseDate ?? ""}
            className="col-span-2 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 md:col-span-1"
          />
        </div>
        <textarea
          name="justification"
          required
          rows={2}
          placeholder="Justificación del gasto (propósito de negocio)"
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Guardando…" : "Confirmar gasto"}
        </button>
      </form>
    </div>
  );
}
