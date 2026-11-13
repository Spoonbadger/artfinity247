-- CreateTable
CREATE TABLE "PrintQueueItem" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrPrintLog" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'home',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrPrintLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodePrintOrder" (
    "id" TEXT NOT NULL,
    "artistId" TEXT,
    "email" TEXT NOT NULL,
    "artistName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "items" JSONB NOT NULL,
    "queueItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cards" INTEGER NOT NULL DEFAULT 0,
    "shipName" TEXT NOT NULL,
    "shipLine1" TEXT NOT NULL,
    "shipLine2" TEXT,
    "shipCity" TEXT NOT NULL,
    "shipState" TEXT NOT NULL,
    "shipZip" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL,
    "handlingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "pricing" JSONB,
    "stripeSessionId" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "refundNote" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "printingAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "CodePrintOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintQueueItem_artistId_idx" ON "PrintQueueItem"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintQueueItem_artistId_qrCodeId_format_key" ON "PrintQueueItem"("artistId", "qrCodeId", "format");

-- CreateIndex
CREATE INDEX "QrPrintLog_qrCodeId_createdAt_idx" ON "QrPrintLog"("qrCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "QrPrintLog_artistId_idx" ON "QrPrintLog"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "CodePrintOrder_stripeSessionId_key" ON "CodePrintOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "CodePrintOrder_artistId_createdAt_idx" ON "CodePrintOrder"("artistId", "createdAt");

-- CreateIndex
CREATE INDEX "CodePrintOrder_status_createdAt_idx" ON "CodePrintOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PrintQueueItem" ADD CONSTRAINT "PrintQueueItem_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueItem" ADD CONSTRAINT "PrintQueueItem_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueItem" ADD CONSTRAINT "PrintQueueItem_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPrintLog" ADD CONSTRAINT "QrPrintLog_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePrintOrder" ADD CONSTRAINT "CodePrintOrder_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

