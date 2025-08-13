/*
  Warnings:

  - A unique constraint covering the columns `[orderId,artworkId,size]` on the table `OrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_artworkId_size_key" ON "OrderItem"("orderId", "artworkId", "size");
