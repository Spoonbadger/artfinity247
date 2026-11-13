-- CreateTable
CREATE TABLE "ScanBooking" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "handoff" TEXT NOT NULL DEFAULT 'dropoff',
    "pickupAddress" TEXT,
    "preferredDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "estimateCents" INTEGER,
    "priceCents" INTEGER,
    "scheduledFor" TIMESTAMP(3),
    "dropoffInfo" TEXT,
    "adminNote" TEXT,
    "stripeSessionId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "scanningAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanBookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "artworkId" TEXT,
    "title" TEXT,
    "band" TEXT NOT NULL,
    "widthIn" DOUBLE PRECISION,
    "heightIn" DOUBLE PRECISION,
    "scanUrl" TEXT,
    "previousImageUrl" TEXT,
    "previousPrintable" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "printableSizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "ScanBookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "artistId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanBooking_stripeSessionId_key" ON "ScanBooking"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ScanBooking_artistId_createdAt_idx" ON "ScanBooking"("artistId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanBooking_status_scheduledFor_idx" ON "ScanBooking"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ScanBookingItem_bookingId_idx" ON "ScanBookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "ScanBookingItem_artworkId_idx" ON "ScanBookingItem"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanWaitlist_email_key" ON "ScanWaitlist"("email");

-- AddForeignKey
ALTER TABLE "ScanBookingItem" ADD CONSTRAINT "ScanBookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ScanBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

