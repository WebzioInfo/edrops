-- CreateTable
CREATE TABLE "profile_update_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "pendingData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_update_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_update_verifications_userId_idx" ON "profile_update_verifications"("userId");

-- CreateIndex
CREATE INDEX "profile_update_verifications_expiresAt_idx" ON "profile_update_verifications"("expiresAt");

-- AddForeignKey
ALTER TABLE "profile_update_verifications" ADD CONSTRAINT "profile_update_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
