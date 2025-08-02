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
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "bio" TEXT DEFAULT ''
);
INSERT INTO "new_Artist" ("bio", "city", "country", "email", "id", "name", "password", "phone", "profileImage", "state") SELECT "bio", "city", "country", "email", "id", "name", "password", "phone", "profileImage", "state" FROM "Artist";
DROP TABLE "Artist";
ALTER TABLE "new_Artist" RENAME TO "Artist";
CREATE UNIQUE INDEX "Artist_email_key" ON "Artist"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
