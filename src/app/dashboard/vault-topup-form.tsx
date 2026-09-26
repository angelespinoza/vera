"use client";

import { useActionState } from "react";
import { topUpVaultAction, type VaultActionState } from "@/app/actions/vault";

const initialState: VaultActionState = {};

export function VaultTopUpForm() {
  const [state, formAction, pending] = useActionState(topUpVaultAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="amountUsdc" className="text-xs font-medium text-text-secondary">
          Monto a mover (USDC, vacío = todo el disponible)
        </label>
        <input
          id="amountUsdc"
          name="amountUsdc"
          type="number"
          step="0.0000001"
          min="0"
          placeholder="Todo el disponible"
          className="w-56 rounded border border-border-subtle bg-surface-card px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {pending ? "Fondeando…" : "Fondear vault desde treasury"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="w-full text-sm text-status-good">{state.message}</p>}
    </form>
  );
}
