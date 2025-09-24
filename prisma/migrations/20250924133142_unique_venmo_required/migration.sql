/*
  Warnings:

  - A unique constraint covering the columns `[venmoHandle]` on the table `Artist` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Artist_venmoHandle_key" ON "Artist"("venmoHandle");
