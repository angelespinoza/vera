"use client";

import { useActionState } from "react";
import { createEmployee } from "@/app/actions/employee";
import type { ActionState } from "@/app/actions/company";

const initialState: ActionState = {};

export function EmployeeForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState(createEmployee, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-sm">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="emp-name"
          name="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="emp-email"
          name="email"
          type="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-role" className="text-sm font-medium">
          Rol / cargo
        </label>
        <input
          id="emp-role"
          name="role"
          required
          placeholder="Product Manager"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Creando wallet en Stellar testnet…" : "Agregar empleado"}
      </button>
    </form>
  );
}
