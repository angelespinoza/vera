import { getCompany } from "./data";
import { getAccountBalances, stellarExpertAccountUrl } from "@/lib/stellar";
import { getVaultBalanceUsdc } from "@/lib/stellar/vault";
import { Card, StatTile, truncateKey } from "./ui";
import { IconTreasury } from "./icons";
import { VaultInitForm } from "./vault-init-form";
import { VaultTopUpForm } from "./vault-topup-form";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const company = await getCompany();
  if (!company) return null;

  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);
  const registeredEmployees = company.employees.filter((e) => e.vaultRegistered).length;
  const vaultBalance =
    company.vaultInitialized && company.vaultContractId
      ? await getVaultBalanceUsdc(company.vaultContractId)
      : null;

  return (
    <>
      <Card title="Treasury (Stellar testnet)">
        <p className="font-mono text-xs text-text-secondary" title={company.treasuryPublicKey}>
          {truncateKey(company.treasuryPublicKey)}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile icon={<IconTreasury />} label="Balance XLM" value={treasuryBalances.xlm} />
          <StatTile icon={<IconTreasury />} label="Balance USDC" value={treasuryBalances.usdc} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a
            href={stellarExpertAccountUrl(company.treasuryPublicKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Ver en Stellar Expert
          </a>
          <p className="text-xs text-text-secondary">
            Para fondear con USDC de prueba: copia la dirección de arriba y pégala en{" "}
            <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="underline">
              faucet.circle.com
            </a>{" "}
            (red Stellar). El trustline ya está establecido.
          </p>
        </div>
      </Card>

      <Card title="Vault on-chain (Soroban)">
        <p className="text-xs text-text-secondary">
          Techo de gasto forzado por contrato: la llave operadora que paga día a día solo puede
          enviar a empleados registrados y nunca más de su tope — si se filtra, el daño máximo es
          acotado, no el treasury completo.
        </p>
        {company.vaultInitialized ? (
          <>
            <p className="font-mono text-xs text-text-secondary" title={company.vaultContractId ?? undefined}>
              {truncateKey(company.vaultContractId ?? "")}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile
                icon={<IconTreasury />}
                label="Balance del vault (USDC)"
                value={vaultBalance !== null ? vaultBalance.toFixed(2) : "—"}
              />
              <StatTile
                icon={<IconTreasury />}
                label="Empleados registrados"
                value={`${registeredEmployees}/${company.employees.length}`}
              />
            </div>
            <VaultTopUpForm />
          </>
        ) : (
          <VaultInitForm />
        )}
      </Card>
    </>
  );
}
