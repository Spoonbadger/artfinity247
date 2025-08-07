/*
  Warnings:

  - You are about to drop the column `price` on the `Artwork` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "markupSmall" INTEGER NOT NULL DEFAULT 0,
    "markupMedium" INTEGER NOT NULL DEFAULT 0,
    "markupLage" INTEGER NOT NULL DEFAULT 0,
    "artistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artwork_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Artwork" ("artistId", "createdAt", "description", "id", "imageUrl", "slug", "title") SELECT "artistId", "createdAt", "description", "id", "imageUrl", "slug", "title" FROM "Artwork";
DROP TABLE "Artwork";
ALTER TABLE "new_Artwork" RENAME TO "Artwork";
CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
