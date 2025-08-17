-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Artist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profileImage" TEXT,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL DEFAULT '',
    "state" TEXT,
    "country" TEXT,
    "slug" TEXT NOT NULL,
    "bio" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Artist" ("bio", "city", "country", "createdAt", "email", "id", "name", "password", "phone", "profileImage", "slug", "state") SELECT "bio", "city", "country", "createdAt", "email", "id", "name", "password", "phone", "profileImage", "slug", "state" FROM "Artist";
DROP TABLE "Artist";
ALTER TABLE "new_Artist" RENAME TO "Artist";
CREATE UNIQUE INDEX "Artist_email_key" ON "Artist"("email");
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");
CREATE INDEX "Artist_citySlug_idx" ON "Artist"("citySlug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
