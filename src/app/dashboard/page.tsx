import { getCompany } from "./data";
import { getAccountBalances, stellarExpertAccountUrl } from "@/lib/stellar";
import { Card, truncateKey } from "./ui";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const company = await getCompany();
  if (!company) return null;

  const treasuryBalances = await getAccountBalances(company.treasuryPublicKey);

  return (
    <Card title="Treasury (Stellar testnet)">
      <p className="font-mono text-xs text-text-secondary" title={company.treasuryPublicKey}>
        {truncateKey(company.treasuryPublicKey)}
      </p>
      <div className="flex gap-6 text-sm">
        <span>
          XLM: <strong className="tabular-nums">{treasuryBalances.xlm}</strong>
        </span>
        <span>
          USDC: <strong className="tabular-nums">{treasuryBalances.usdc}</strong>
        </span>
      </div>
      <a
        href={stellarExpertAccountUrl(company.treasuryPublicKey)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit text-sm underline"
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
    </Card>
  );
}
