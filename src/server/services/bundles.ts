import "server-only";
import { prisma } from "@/server/db";
import { assertSellerOwns } from "@/server/rbac";

export { getBundleAvailableStock } from "./inventory";

export class BundleError extends Error {}

/** Seller's own SIMPLE products — the only valid bundle components. */
export function listSimpleProductsForSeller(sellerId: string) {
  return prisma.product.findMany({
    where: { sellerId, type: "SIMPLE" },
    select: { id: true, name: true, sku: true, price: true, currencyCode: true },
    orderBy: { name: "asc" },
  });
}

export function listBundleComponents(bundleProductId: string) {
  return prisma.productBundleItem.findMany({
    where: { bundleProductId },
    include: { componentProduct: { select: { id: true, name: true, sku: true, price: true, currencyCode: true } } },
    orderBy: { id: "asc" },
  });
}

async function requireOwnedBundle(sellerId: string, bundleProductId: string) {
  const bundle = await prisma.product.findUnique({ where: { id: bundleProductId } });
  if (!bundle) throw new BundleError("Bundle product not found.");
  assertSellerOwns(bundle.sellerId, sellerId);
  if (bundle.type !== "BUNDLE") throw new BundleError("This product isn't a bundle.");
  return bundle;
}

export async function addBundleComponent(
  sellerId: string,
  bundleProductId: string,
  componentProductId: string,
  quantity: number,
) {
  await requireOwnedBundle(sellerId, bundleProductId);
  if (componentProductId === bundleProductId) {
    throw new BundleError("A bundle can't contain itself.");
  }

  const component = await prisma.product.findUnique({ where: { id: componentProductId } });
  if (!component) throw new BundleError("Component product not found.");
  assertSellerOwns(component.sellerId, sellerId);
  if (component.type !== "SIMPLE") {
    throw new BundleError("Bundles can only contain simple (physical) products — not other bundles or digital products.");
  }

  const existing = await prisma.productBundleItem.findUnique({
    where: { bundleProductId_componentProductId: { bundleProductId, componentProductId } },
  });
  if (existing) throw new BundleError("This product is already in the bundle.");

  return prisma.productBundleItem.create({
    data: { bundleProductId, componentProductId, quantity },
  });
}

export async function removeBundleComponent(sellerId: string, id: string) {
  const item = await prisma.productBundleItem.findUnique({ where: { id } });
  if (!item) throw new BundleError("Bundle component not found.");
  await requireOwnedBundle(sellerId, item.bundleProductId);
  await prisma.productBundleItem.delete({ where: { id } });
}

/** componentProductId + quantity-per-bundle-unit, for reserving stock at checkout. */
export function getBundleComponentQuantities(bundleProductId: string) {
  return prisma.productBundleItem.findMany({
    where: { bundleProductId },
    select: { componentProductId: true, quantity: true },
  });
}

/**
 * Expands a bundle OrderItem's productId into its component
 * {productId, variantId} pairs, and passes any other product through
 * unchanged — used everywhere the order lifecycle (checkout.ts's
 * reservation, orders.ts's release/convert-to-sale/restock) needs to know
 * which real Inventory rows an order line actually touched. A bundle's
 * OrderItem.productId itself never has any InventoryMovement rows — only
 * its components do — so every one of those call sites must expand
 * through here rather than using the OrderItem's productId directly.
 */
export async function expandOrderItemForInventory(
  productId: string,
  variantId: string | null,
): Promise<{ productId: string; variantId: string | null }[]> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { type: true } });
  if (product?.type !== "BUNDLE") return [{ productId, variantId }];

  const items = await prisma.productBundleItem.findMany({ where: { bundleProductId: productId } });
  return items.map((item) => ({ productId: item.componentProductId, variantId: null }));
}
