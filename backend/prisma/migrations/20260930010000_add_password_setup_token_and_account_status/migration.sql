-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_PASSWORD_SETUP', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "password_setup_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'ACCOUNT_ACTIVATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_setup_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_setup_tokens_tokenHash_key" ON "password_setup_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_setup_tokens_userId_idx" ON "password_setup_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_setup_tokens_tokenHash_idx" ON "password_setup_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_setup_tokens_expiresAt_idx" ON "password_setup_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
