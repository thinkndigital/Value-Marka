import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { addToCart, computeCartTotals, CartError } from "@/server/services/cart";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";

// Cart pricing and stock/currency guards, verified against the real
// database — the client never gets to declare a total (ARCHITECTURE.md §3).

const PREFIX = "cart-test-";

let sellerId: string;
let warehouseId: string;
let categoryId: string;
let productUsdId: string;
let productEurId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Cart",
      lastName: "Tester",
      passwordHash: "unused",
    },
  });

  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Cart Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Cart Test Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;

  const [productUsd, productEur] = await Promise.all([
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}usd-product-${Date.now()}`,
        sku: "CART-USD-1",
        name: "Cart Test USD Product",
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}eur-product-${Date.now()}`,
        sku: "CART-EUR-1",
        name: "Cart Test EUR Product",
        price: "8.00",
        costPrice: "4.00",
        currencyCode: "EUR",
        status: "ACTIVE",
      },
    }),
  ]);
  productUsdId = productUsd.id;
  productEurId = productEur.id;

  await recordInventoryMovementStandalone({
    productId: productUsdId,
    warehouseId,
    type: "PURCHASE",
    quantity: 3,
    reason: "test opening stock",
  });
  await recordInventoryMovementStandalone({
    productId: productEurId,
    warehouseId,
    type: "PURCHASE",
    quantity: 3,
    reason: "test opening stock",
  });
});

afterAll(async () => {
  await prisma.cartItem.deleteMany({ where: { product: { sellerId } } });
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: PREFIX } } });
  await prisma.inventoryMovement.deleteMany({
    where: { inventory: { productId: { in: [productUsdId, productEurId] } } },
  });
  await prisma.inventory.deleteMany({ where: { productId: { in: [productUsdId, productEurId] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productUsdId, productEurId] } } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("computeCartTotals", () => {
  it("sums quantity × price across line items", () => {
    const { subtotal } = computeCartTotals([
      { quantity: 2, product: { price: { toString: () => "10.00" } as never } },
      { quantity: 1, product: { price: { toString: () => "8.00" } as never } },
    ]);
    // Number(Decimal) works on the real Prisma Decimal values at runtime;
    // this stub only needs to support the arithmetic computeCartTotals does.
    expect(subtotal).toBeCloseTo(2 * 10 + 1 * 8, 2);
  });
});

describe("addToCart", () => {
  it("adds a new line item and reuses it on a second add", async () => {
    const cart = await prisma.cart.create({ data: { guestToken: `${PREFIX}${Date.now()}` } });

    await addToCart(cart.id, productUsdId, 1);
    await addToCart(cart.id, productUsdId, 1);

    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("refuses to add more than is available in stock", async () => {
    const cart = await prisma.cart.create({ data: { guestToken: `${PREFIX}${Date.now()}` } });

    await expect(addToCart(cart.id, productUsdId, 999)).rejects.toBeInstanceOf(CartError);
  });

  it("refuses to mix currencies in a single cart", async () => {
    const cart = await prisma.cart.create({ data: { guestToken: `${PREFIX}${Date.now()}` } });

    await addToCart(cart.id, productUsdId, 1);
    await expect(addToCart(cart.id, productEurId, 1)).rejects.toBeInstanceOf(CartError);
  });
});
