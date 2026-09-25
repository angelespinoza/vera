import { getCompany } from "./data";
import { getAccountBalances, stellarExpertAccountUrl } from "@/lib/stellar";
import { Card, StatTile, truncateKey } from "./ui";
import { IconTreasury } from "./icons";

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
  );
}
