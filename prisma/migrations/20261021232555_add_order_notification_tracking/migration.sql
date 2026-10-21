-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNotificationSentAt" TIMESTAMP(3),
ADD COLUMN     "artistNotificationsSentAt" TIMESTAMP(3);
