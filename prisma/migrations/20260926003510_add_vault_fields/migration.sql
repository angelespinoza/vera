-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "vaultContractId" TEXT,
ADD COLUMN     "vaultInitialized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vaultOperatorPublicKey" TEXT,
ADD COLUMN     "vaultOperatorSecretEncrypted" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "vaultLimit" DOUBLE PRECISION,
ADD COLUMN     "vaultRegistered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidViaVault" BOOLEAN NOT NULL DEFAULT false;
