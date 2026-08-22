import "server-only";
import { prisma } from "@/server/db";
import { getStorageProvider } from "@/server/storage";
import { assertSellerOwns } from "@/server/rbac";

export class DigitalProductError extends Error {}

const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export interface DigitalFileUpload {
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
}

/** Attaches (or replaces) the deliverable for a seller's own DIGITAL product. */
export async function setDigitalFile(sellerId: string, productId: string, upload: DigitalFileUpload) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new DigitalProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);
  if (product.type !== "DIGITAL") {
    throw new DigitalProductError("Only digital products can have a deliverable file.");
  }

  const existing = await prisma.digitalProductFile.findUnique({ where: { productId } });
  if (existing) {
    await getStorageProvider()
      .delete(existing.storageKey)
      .catch(() => {
        // Old file may already be gone — the new one taking its place is what matters.
      });
  }

  return prisma.digitalProductFile.upsert({
    where: { productId },
    create: { productId, ...upload },
    update: upload,
  });
}

export async function getDigitalFileForSeller(sellerId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new DigitalProductError("Product not found.");
  assertSellerOwns(product.sellerId, sellerId);
  return prisma.digitalProductFile.findUnique({ where: { productId } });
}

/**
 * The only path to an actual download. Re-checks entitlement against the
 * database on every call (never trusts a cached "you own this" flag): the
 * order item must belong to an order placed by this user, and that
 * seller-order must not be cancelled. Scope note: gated on "not cancelled"
 * rather than a payment-confirmed or physical-delivery status — a digital
 * good has no shipment to wait for, and this mirrors how COD orders are
 * already accepted platform-wide; see the P2.14 commit for the full
 * reasoning.
 */
export async function getDownloadUrlForOrderItem(userId: string, orderItemId: string) {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      sellerOrder: { include: { order: { select: { userId: true } } } },
      product: { include: { digitalFile: true } },
    },
  });
  if (!orderItem || orderItem.sellerOrder.order.userId !== userId) {
    throw new DigitalProductError("Order item not found.");
  }
  if (orderItem.sellerOrder.status === "CANCELLED") {
    throw new DigitalProductError("This order was cancelled.");
  }
  if (!orderItem.product.digitalFile) {
    throw new DigitalProductError("No file is available for this product.");
  }

  const file = orderItem.product.digitalFile;
  const url = await getStorageProvider().getSignedDownloadUrl(
    file.storageKey,
    DOWNLOAD_URL_TTL_SECONDS,
    file.fileName,
  );
  return { url, fileName: file.fileName };
}
