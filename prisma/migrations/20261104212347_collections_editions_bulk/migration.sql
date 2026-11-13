-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "editionSize" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bulkArtistId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'retail';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "editionNumber" INTEGER;

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "coverArtworkId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_artistId_position_idx" ON "Collection"("artistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_artistId_slug_key" ON "Collection"("artistId", "slug");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_position_idx" ON "CollectionItem"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_artworkId_key" ON "CollectionItem"("collectionId", "artworkId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
