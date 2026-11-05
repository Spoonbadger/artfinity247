-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "socialFeature" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "kind" TEXT NOT NULL DEFAULT 'artwork',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "artistId" TEXT,
    "artworkId" TEXT,
    "artworkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collectionId" TEXT,
    "eventId" TEXT,
    "headline" TEXT,
    "preset" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vertical',
    "caption" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "igContainerId" TEXT,
    "igMediaId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3),
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledFor_idx" ON "SocialPost"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SocialPost_artworkId_idx" ON "SocialPost"("artworkId");

-- CreateIndex
CREATE INDEX "SocialPost_artistId_idx" ON "SocialPost"("artistId");

