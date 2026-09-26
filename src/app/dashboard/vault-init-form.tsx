"use client";

import { useActionState } from "react";
import { initializeVaultAction, type VaultActionState } from "@/app/actions/vault";

const initialState: VaultActionState = {};

export function VaultInitForm() {
  const [state, formAction, pending] = useActionState(initializeVaultAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-sm text-text-secondary">
        El vault todavía no está inicializado on-chain. Al inicializarlo se genera una llave
        operadora nueva (nunca la del treasury), se registra a cada empleado con un tope de demo y
        se fondea con USDC del treasury.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-status-good">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {pending ? "Inicializando vault en Stellar testnet…" : "Inicializar vault"}
      </button>
    </form>
  );
}
