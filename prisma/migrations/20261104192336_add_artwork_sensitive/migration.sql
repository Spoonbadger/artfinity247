-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "sensitive" TEXT[] DEFAULT ARRAY[]::TEXT[];
