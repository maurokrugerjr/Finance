-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DEBIT', 'CREDIT');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "accountId",
ADD COLUMN     "paymentMethod" "PaymentMethod";

-- DropTable
DROP TABLE "Account";

-- DropEnum
DROP TYPE "AccountType";
