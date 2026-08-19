-- AlterTable
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
