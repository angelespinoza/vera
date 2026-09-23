-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentError" TEXT,
ADD COLUMN     "paymentTxHash" TEXT;
