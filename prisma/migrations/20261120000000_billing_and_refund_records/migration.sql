-- Money data gets real columns and a real table:
--   * Infinity subscription state moves from a JSON Message row (direction 'billing', email 'billing:infinity') onto
--     the Artist row. Artist.stripeCustomerId is unique, so the billing webhook finds the artist with an index.
--   * Refunds move from replaying "order.refund" / "order.refund_undo" AdminAction rows to a Refund table. The audit
--     rows stay where they are (the audit log keeps its history); only the money logic stops reading them.
-- The backfills below only matter for development databases: production has no rows in the old storage yet.

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "billing" JSONB,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionInterval" TEXT,
ADD COLUMN     "subscriptionPaymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "subscriptionTrialEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "artistId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "shareCents" INTEGER NOT NULL,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "deducted" BOOLEAN NOT NULL DEFAULT false,
    "adjustMonth" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByEmail" TEXT NOT NULL DEFAULT '',
    "undoneAt" TIMESTAMP(3),
    "undoneByEmail" TEXT,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_orderItemId_idx" ON "Refund"("orderItemId");

-- CreateIndex
CREATE INDEX "Refund_artistId_idx" ON "Refund"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_stripeCustomerId_key" ON "Artist"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: billing state (Message JSON) -> Artist columns. One row per artist (the newest if there are several).
-- A row that can't be read (bad JSON, a customer id already on another artist) is skipped and kept, with a notice.
DO $$
DECLARE
  r RECORD;
  j JSONB;
BEGIN
  FOR r IN
    SELECT DISTINCT ON ("artistId") "artistId", "body"
    FROM "Message"
    WHERE "direction" = 'billing' AND "email" = 'billing:infinity'
    ORDER BY "artistId", "createdAt" DESC, "id" DESC
  LOOP
    BEGIN
      j := r."body"::jsonb;
      IF jsonb_typeof(j) <> 'object' THEN
        RAISE NOTICE 'Billing state for artist % is not a JSON object; skipped', r."artistId";
        CONTINUE;
      END IF;
      UPDATE "Artist" SET
        "stripeCustomerId"              = NULLIF(j->>'customerId', ''),
        "stripeSubscriptionId"          = NULLIF(j->>'subscriptionId', ''),
        "subscriptionStatus"            = NULLIF(j->>'status', ''),
        "subscriptionInterval"          = CASE WHEN j->>'interval' IN ('month', 'year') THEN j->>'interval' END,
        "subscriptionPeriodEnd"         = (NULLIF(j->>'periodEnd', '')::timestamptz AT TIME ZONE 'UTC'),
        "subscriptionTrialEnd"          = (NULLIF(j->>'trialEnd', '')::timestamptz AT TIME ZONE 'UTC'),
        "subscriptionCancelAtPeriodEnd" = COALESCE(j->'cancelAtPeriodEnd' = 'true'::jsonb, false),
        "subscriptionPaymentFailedAt"   = (NULLIF(j->>'paymentFailedAt', '')::timestamptz AT TIME ZONE 'UTC'),
        "billing" = jsonb_build_object(
          'endedAt', j->'endedAt',
          'failedInvoiceId', j->'failedInvoiceId',
          'subProUntil', j->'subProUntil',
          'simulated', COALESCE(j->'simulated' = 'true'::jsonb, false),
          'eventAt', j->'eventAt',
          'updatedAt', j->'updatedAt'
        )
      WHERE "id" = r."artistId";
      DELETE FROM "Message" WHERE "artistId" = r."artistId" AND "direction" = 'billing' AND "email" = 'billing:infinity';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Billing state for artist % skipped: %', r."artistId", SQLERRM;
    END;
  END LOOP;
END $$;

-- Backfill: refunds. Each "order.refund" audit row becomes a Refund row (same id). It is undone by the first
-- "order.refund_undo" for the same line after it (an undo always cleared the line), which gives the same lines
-- refunded as replaying the log did. Lines or orders that no longer exist are left out.
INSERT INTO "Refund" (
  "id", "orderId", "orderItemId", "artistId", "amountCents", "shareCents", "reversed", "deducted", "adjustMonth",
  "reason", "title", "note", "createdAt", "createdByEmail", "undoneAt", "undoneByEmail"
)
SELECT
  a."id",
  o."id",
  oi."id",
  (SELECT ar."id" FROM "Artist" ar WHERE ar."id" = a."details"->>'artistId'),
  CASE WHEN a."details"->>'amountCents' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN round((a."details"->>'amountCents')::numeric)::int ELSE 0 END,
  CASE WHEN a."details"->>'shareCents' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN round((a."details"->>'shareCents')::numeric)::int ELSE 0 END,
  COALESCE(a."details"->'reversed' = 'true'::jsonb, false),
  COALESCE(a."details"->'deducted' = 'true'::jsonb, false) AND NOT COALESCE(a."details"->'reversed' = 'true'::jsonb, false),
  CASE
    WHEN COALESCE(a."details"->'deducted' = 'true'::jsonb, false)
      AND NOT COALESCE(a."details"->'reversed' = 'true'::jsonb, false)
      AND jsonb_typeof(a."details"->'adjustMonth') = 'string'
    THEN a."details"->>'adjustMonth'
  END,
  CASE WHEN jsonb_typeof(a."details"->'reason') = 'string' THEN a."details"->>'reason' ELSE 'other' END,
  CASE WHEN jsonb_typeof(a."details"->'title') = 'string' THEN a."details"->>'title' ELSE '' END,
  CASE WHEN jsonb_typeof(a."details"->'note') = 'string' THEN a."details"->>'note' ELSE '' END,
  a."createdAt",
  a."adminEmail",
  u."createdAt",
  u."adminEmail"
FROM "AdminAction" a
JOIN "Order" o ON o."id" = a."targetId"
JOIN "OrderItem" oi ON oi."id" = a."details"->>'orderItemId'
LEFT JOIN LATERAL (
  SELECT x."createdAt", x."adminEmail"
  FROM "AdminAction" x
  WHERE x."action" = 'order.refund_undo'
    AND x."targetType" = 'order'
    AND x."details"->>'orderItemId' = a."details"->>'orderItemId'
    AND (x."createdAt", x."id") > (a."createdAt", a."id")
  ORDER BY x."createdAt", x."id"
  LIMIT 1
) u ON true
WHERE a."action" = 'order.refund'
  AND a."targetType" = 'order'
  AND jsonb_typeof(a."details") = 'object';
