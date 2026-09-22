"use client";

import { useActionState } from "react";
import { createCompany, type ActionState } from "@/app/actions/company";

const initialState: ActionState = {};

export function CompanyForm() {
  const [state, formAction, pending] = useActionState(createCompany, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Nombre de la empresa
        </label>
        <input
          id="name"
          name="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cfoEmail" className="text-sm font-medium">
          Email del CFO
        </label>
        <input
          id="cfoEmail"
          name="cfoEmail"
          type="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Creando empresa y treasury en Stellar testnet…" : "Crear empresa"}
      </button>
    </form>
  );
}
