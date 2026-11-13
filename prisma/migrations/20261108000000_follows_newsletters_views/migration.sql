-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "imageHash" TEXT;

-- CreateTable
CREATE TABLE "Follower" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'page',
    "token" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "artworkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "artistId" TEXT,
    "artworkId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "referrer" TEXT,
    "visitorId" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Follower_token_key" ON "Follower"("token");

-- CreateIndex
CREATE INDEX "Follower_artistId_confirmedAt_idx" ON "Follower"("artistId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Follower_artistId_email_key" ON "Follower"("artistId", "email");

-- CreateIndex
CREATE INDEX "Newsletter_artistId_createdAt_idx" ON "Newsletter"("artistId", "createdAt");

-- CreateIndex
CREATE INDEX "PageView_artistId_createdAt_idx" ON "PageView"("artistId", "createdAt");

-- CreateIndex
CREATE INDEX "PageView_artworkId_createdAt_idx" ON "PageView"("artworkId", "createdAt");

-- CreateIndex
CREATE INDEX "Artwork_imageHash_idx" ON "Artwork"("imageHash");

-- AddForeignKey
ALTER TABLE "Follower" ADD CONSTRAINT "Follower_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Newsletter" ADD CONSTRAINT "Newsletter_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

