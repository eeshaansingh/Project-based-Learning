-- AlterTable
ALTER TABLE "User" ADD COLUMN "mfaSetupTokenExpires" DATETIME;
ALTER TABLE "User" ADD COLUMN "mfaSetupTokenHash" TEXT;
