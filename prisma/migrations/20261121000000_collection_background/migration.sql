-- Artists can pick the background of a collection page: a palette color, or one of its paintings with blur and tint.
-- Null keeps the gallery wall every collection has today.

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "background" JSONB;
