-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyToken" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Artist_emailVerifyToken_key" ON "Artist"("emailVerifyToken");


-- Existing accounts (created before verification existed) count as verified
UPDATE "Artist" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
