-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "artworkId" TEXT,
    "slug" TEXT,
    "size" TEXT,
    "unitPrice" INTEGER,
    "quantity" INTEGER,
    "lineTotal" INTEGER,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("artworkId", "id", "lineTotal", "orderId", "quantity", "size", "slug", "unitPrice") SELECT "artworkId", "id", "lineTotal", "orderId", "quantity", "size", "slug", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_artworkId_idx" ON "OrderItem"("artworkId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
