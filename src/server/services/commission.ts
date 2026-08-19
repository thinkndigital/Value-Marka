import "server-only";
import { prisma } from "@/server/db";

/**
 * Resolves the effective commission rate for one order line, most specific
 * scope wins (DATABASE.md §7):
 *   PRODUCT → SELLER_CATEGORY → SELLER → CATEGORY → GLOBAL
 * `Seller.commissionOverride` is a convenience shortcut equivalent to a
 * SELLER-scope rule and is checked at that point in the chain, not before
 * PRODUCT/SELLER_CATEGORY (which are more specific).
 */
export async function resolveCommissionRate(
  sellerId: string,
  categoryId: string,
  productId: string,
): Promise<number> {
  const rules = await prisma.commissionRule.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: "PRODUCT", productId },
        { scope: "SELLER_CATEGORY", sellerId, categoryId },
        { scope: "SELLER", sellerId },
        { scope: "CATEGORY", categoryId },
        { scope: "GLOBAL" },
      ],
    },
    orderBy: { priority: "desc" },
  });

  const bestByScope = (scope: (typeof rules)[number]["scope"]) =>
    rules.find((r) => r.scope === scope);

  const product = bestByScope("PRODUCT");
  if (product) return Number(product.rate);

  const sellerCategory = bestByScope("SELLER_CATEGORY");
  if (sellerCategory) return Number(sellerCategory.rate);

  const seller = bestByScope("SELLER");
  if (seller) return Number(seller.rate);

  const sellerRecord = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { commissionOverride: true },
  });
  if (sellerRecord?.commissionOverride != null) return Number(sellerRecord.commissionOverride);

  const category = bestByScope("CATEGORY");
  if (category) return Number(category.rate);

  const global = bestByScope("GLOBAL");
  if (global) return Number(global.rate);

  return 0;
}
