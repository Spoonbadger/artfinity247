/*
  Warnings:

  - You are about to drop the column `artworkId` on the `Order` table. All the data in the column will be lost.
  - Made the column `amountTotal` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `currency` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `paymentStatus` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "artworkId" TEXT,
    "slug" TEXT,
    "size" TEXT,
    "unitPrice" INTEGER,
    "quantity" INTEGER,
    "lineTotal" INTEGER,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stripeSessionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "amountTotal" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("amountTotal", "createdAt", "currency", "email", "id", "paymentStatus", "stripeSessionId") SELECT "amountTotal", "createdAt", "currency", "email", "id", "paymentStatus", "stripeSessionId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
