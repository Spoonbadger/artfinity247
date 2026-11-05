-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "venmoPending" TEXT,
ADD COLUMN     "venmoPendingAt" TIMESTAMP(3),
ADD COLUMN     "venmoPendingToken" TEXT;

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "ownershipConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "printableSizes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "StudioEvent" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtReport" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT,
    "artworkUrl" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isRightsHolder" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ArtReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioEvent_artistId_start_idx" ON "StudioEvent"("artistId", "start");

-- CreateIndex
CREATE INDEX "ArtReport_status_createdAt_idx" ON "ArtReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_venmoPendingToken_key" ON "Artist"("venmoPendingToken");

-- AddForeignKey
ALTER TABLE "StudioEvent" ADD CONSTRAINT "StudioEvent_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtReport" ADD CONSTRAINT "ArtReport_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

