/*
  Warnings:

  - Made the column `title` on table `Artwork` required. This step will fail if there are existing NULL values in that column.

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
    "price" INTEGER NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artwork_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Artwork" ("artistId", "createdAt", "description", "id", "imageUrl", "price", "title") SELECT "artistId", "createdAt", "description", "id", "imageUrl", "price", "title" FROM "Artwork";
DROP TABLE "Artwork";
ALTER TABLE "new_Artwork" RENAME TO "Artwork";
CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
