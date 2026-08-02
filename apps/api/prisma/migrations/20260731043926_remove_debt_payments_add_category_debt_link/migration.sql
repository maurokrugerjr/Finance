/*
  Warnings:

  - You are about to drop the `DebtPayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DebtPayment" DROP CONSTRAINT "DebtPayment_debtId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "debtId" TEXT;

-- DropTable
DROP TABLE "DebtPayment";

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
