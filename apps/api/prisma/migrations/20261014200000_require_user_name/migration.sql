-- Usuários antigos sem nome recebem a parte do e-mail antes do "@".
UPDATE "User" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL OR btrim("name") = '';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
