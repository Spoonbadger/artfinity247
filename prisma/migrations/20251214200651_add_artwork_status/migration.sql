-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "flaggedBy" TEXT,
ADD COLUMN     "flaggedReason" TEXT,
ADD COLUMN     "status" "ArtworkStatus" NOT NULL DEFAULT 'PENDING';
