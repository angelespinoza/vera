-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bulkImported" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "receiptFile" DROP NOT NULL,
ALTER COLUMN "receiptMimeType" DROP NOT NULL;
