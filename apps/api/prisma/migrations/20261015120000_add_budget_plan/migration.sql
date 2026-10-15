-- CreateEnum
CREATE TYPE "BudgetGroup" AS ENUM ('ESSENTIALS', 'LIFESTYLE', 'SAVINGS', 'DEBTS');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "budgetGroup" "BudgetGroup",
ADD COLUMN     "budgetPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyIncome" DECIMAL(14,2);

