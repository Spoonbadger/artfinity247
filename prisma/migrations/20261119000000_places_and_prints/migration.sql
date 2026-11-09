-- AlterTable
ALTER TABLE "PrintQueueItem" ADD COLUMN     "placeId" TEXT;

-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "placeId" TEXT;

-- AlterTable
ALTER TABLE "StudioEvent" ADD COLUMN     "placeId" TEXT;

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'cafe',
    "area" TEXT,
    "venueId" TEXT,
    "startsOn" TEXT,
    "endsOn" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),
    "afterEnd" TEXT NOT NULL DEFAULT 'art',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hanging" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Hanging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodePrint" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "artworkId" TEXT,
    "artistId" TEXT NOT NULL,
    "placeId" TEXT,
    "format" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "ink" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "priceShownCents" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "design" JSONB,
    "source" TEXT NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "CodePrint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Place_artistId_idx" ON "Place"("artistId");

-- CreateIndex
CREATE INDEX "Place_venueId_idx" ON "Place"("venueId");

-- CreateIndex
CREATE INDEX "Hanging_artworkId_endedAt_idx" ON "Hanging"("artworkId", "endedAt");

-- CreateIndex
CREATE INDEX "Hanging_placeId_endedAt_idx" ON "Hanging"("placeId", "endedAt");

-- CreateIndex
CREATE INDEX "Hanging_artistId_endedAt_idx" ON "Hanging"("artistId", "endedAt");

-- CreateIndex
CREATE INDEX "CodePrint_qrCodeId_printedAt_idx" ON "CodePrint"("qrCodeId", "printedAt");

-- CreateIndex
CREATE INDEX "CodePrint_artistId_replacedAt_idx" ON "CodePrint"("artistId", "replacedAt");

-- CreateIndex
CREATE INDEX "CodePrint_artworkId_idx" ON "CodePrint"("artworkId");

-- CreateIndex
CREATE INDEX "QrCode_placeId_idx" ON "QrCode"("placeId");

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioEvent" ADD CONSTRAINT "StudioEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintQueueItem" ADD CONSTRAINT "PrintQueueItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hanging" ADD CONSTRAINT "Hanging_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hanging" ADD CONSTRAINT "Hanging_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePrint" ADD CONSTRAINT "CodePrint_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePrint" ADD CONSTRAINT "CodePrint_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePrint" ADD CONSTRAINT "CodePrint_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------------------------
-- Data: each artist's existing venues become their Places. Nothing is dropped: QrCode.venue / venueId and
-- StudioEvent.venue stay as they are, and now mirror (or sit beside) the Place they belong to.
-- Kind is a best guess from the name; artists can change it on /studio/places.

-- 1. Partner venues on codes: one Place per artist and partner venue (keeps revenue share: venueId carries over).
INSERT INTO "Place" ("id", "artistId", "name", "kind", "area", "venueId", "createdAt", "updatedAt")
SELECT 'pl' || substr(md5(random()::text || clock_timestamp()::text || t."artistId" || t."venueId"), 1, 23),
       t."artistId", t."name",
       CASE WHEN t."name" ~* '(caf[eé]|coffee|espresso|bakery|tea)' THEN 'cafe'
            WHEN t."name" ~* 'galler' THEN 'gallery'
            WHEN t."name" ~* '(market|flea|fair|bazaar)' THEN 'market'
            WHEN t."name" ~* 'studio' THEN 'studio'
            WHEN t."name" ~* '(shop|store|boutique|books)' THEN 'shop'
            ELSE 'other' END,
       t."area", t."venueId", t."first", CURRENT_TIMESTAMP
FROM (
  SELECT q."artistId", v."id" AS "venueId", v."name", COALESCE(v."neighborhood", v."address") AS "area", MIN(q."createdAt") AS "first"
  FROM "QrCode" q JOIN "Venue" v ON v."id" = q."venueId"
  GROUP BY q."artistId", v."id", v."name", v."neighborhood", v."address"
) t;

-- 2. Free-text venue names on codes (no partner venue): one Place per artist and name (case and spaces ignored).
INSERT INTO "Place" ("id", "artistId", "name", "kind", "createdAt", "updatedAt")
SELECT 'pl' || substr(md5(random()::text || clock_timestamp()::text || t."artistId" || t."k"), 1, 23),
       t."artistId", t."name",
       CASE WHEN t."name" ~* '(caf[eé]|coffee|espresso|bakery|tea)' THEN 'cafe'
            WHEN t."name" ~* 'galler' THEN 'gallery'
            WHEN t."name" ~* '(market|flea|fair|bazaar)' THEN 'market'
            WHEN t."name" ~* 'studio' THEN 'studio'
            WHEN t."name" ~* '(shop|store|boutique|books)' THEN 'shop'
            ELSE 'other' END,
       t."first", CURRENT_TIMESTAMP
FROM (
  SELECT q."artistId", lower(btrim(q."venue")) AS "k", MIN(btrim(q."venue")) AS "name", MIN(q."createdAt") AS "first"
  FROM "QrCode" q
  WHERE q."venueId" IS NULL AND btrim(COALESCE(q."venue", '')) <> ''
  GROUP BY q."artistId", lower(btrim(q."venue"))
) t
WHERE NOT EXISTS (SELECT 1 FROM "Place" p WHERE p."artistId" = t."artistId" AND p."venueId" IS NULL AND lower(btrim(p."name")) = t."k");

-- 3. Codes join their Place: partner venue codes by venue, free-text codes by name (only Places without a partner
--    venue, so no code starts earning a venue a share it didn't before). Their venue text becomes the Place's name.
UPDATE "QrCode" q SET "placeId" = p."id"
FROM "Place" p
WHERE q."venueId" IS NOT NULL AND p."artistId" = q."artistId" AND p."venueId" = q."venueId";

UPDATE "QrCode" q SET "placeId" = p."id"
FROM "Place" p
WHERE q."placeId" IS NULL AND q."venueId" IS NULL AND btrim(COALESCE(q."venue", '')) <> ''
  AND p."artistId" = q."artistId" AND p."venueId" IS NULL AND lower(btrim(p."name")) = lower(btrim(q."venue"));

UPDATE "QrCode" q SET "venue" = left(p."name", 60)
FROM "Place" p
WHERE q."placeId" = p."id" AND q."venue" IS DISTINCT FROM left(p."name", 60);

-- 4. Studio events: an event links to the artist's Place of the same name; otherwise its own Place is made, with the
--    event's dates (several events with one name share a Place, spanning all their dates). Events keep their fields.
INSERT INTO "Place" ("id", "artistId", "name", "kind", "area", "startsOn", "endsOn", "createdAt", "updatedAt")
SELECT 'pl' || substr(md5(random()::text || clock_timestamp()::text || t."artistId" || t."k"), 1, 23),
       t."artistId", t."name",
       CASE WHEN t."name" ~* '(market|flea|fair|bazaar)' THEN 'market'
            WHEN t."name" ~* 'studio' THEN 'studio'
            WHEN t."name" ~* 'galler' THEN 'gallery'
            ELSE 'popup' END,
       NULLIF(t."area", ''), t."startsOn", t."endsOn", t."first", CURRENT_TIMESTAMP
FROM (
  SELECT e."artistId", lower(btrim(e."name")) AS "k", MIN(btrim(e."name")) AS "name", MIN(btrim(e."venue")) AS "area",
         MIN(e."start") AS "startsOn", MAX(e."end") AS "endsOn", MIN(e."createdAt") AS "first"
  FROM "StudioEvent" e
  WHERE btrim(e."name") <> ''
  GROUP BY e."artistId", lower(btrim(e."name"))
) t
WHERE NOT EXISTS (SELECT 1 FROM "Place" p WHERE p."artistId" = t."artistId" AND lower(btrim(p."name")) = t."k");

UPDATE "StudioEvent" e SET "placeId" = (
  SELECT p."id" FROM "Place" p
  WHERE p."artistId" = e."artistId" AND lower(btrim(p."name")) = lower(btrim(e."name"))
  ORDER BY (p."venueId" IS NULL), p."createdAt" LIMIT 1
)
WHERE e."placeId" IS NULL;
