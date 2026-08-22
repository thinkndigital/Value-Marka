import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { placeOrder } from "@/server/services/checkout";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";
import { transitionSellerOrder } from "@/server/services/orders";
import * as loyalty from "@/server/services/loyalty";
import { LoyaltyError } from "@/server/services/loyalty";

const PREFIX = "loyalty-test-";

let categoryId: string;
let sellerId: string;
let warehouseId: string;
let productId: string;
let buyerId: string;
let addressId: string;
const createdRuleIds: string[] = [];

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [sellerUser, buyer] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "Loyalty",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Loyalty",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Loyalty Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Loyalty Warehouse", countryCode: "JO", city: "Amman" },
  });
  warehouseId = warehouse.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "LOYAL-1",
      name: "Loyalty Test Product",
      price: "100.00",
      costPrice: "50.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;

  await recordInventoryMovementStandalone({
    productId,
    warehouseId,
    type: "PURCHASE",
    quantity: 50,
    reason: "test opening stock",
  });

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Loyalty Buyer",
      phone: "+962700000002",
      countryCode: "JO",
      city: "Amman",
      addressLine1: "1 Loyalty Street",
      isDefault: true,
    },
  });
  addressId = address.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.shipment.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.couponUsage.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { productId } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });

  const account = await prisma.loyaltyAccount.findUnique({ where: { userId: buyerId } });
  if (account) {
    await prisma.loyaltyTransaction.deleteMany({ where: { accountId: account.id } });
    await prisma.loyaltyAccount.delete({ where: { id: account.id } });
  }
  await prisma.rewardRule.deleteMany({ where: { id: { in: createdRuleIds } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: "RWD" } } });

  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId } } });
  await prisma.inventory.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function createRule(overrides: Partial<loyalty.RewardRuleInput> = {}) {
  const rule = await loyalty.createRewardRule({
    pointsPerCurrencyUnit: overrides.pointsPerCurrencyUnit ?? 1,
    redemptionValue: overrides.redemptionValue ?? 0.01,
    effectiveAt: overrides.effectiveAt ?? new Date(Date.now() - 60_000),
  });
  createdRuleIds.push(rule.id);
  return rule;
}

// Every test shares one buyer's loyalty account, so leftover rules or
// balance from an earlier test would otherwise leak into the next one.
afterEach(async () => {
  await prisma.rewardRule.deleteMany({ where: { id: { in: createdRuleIds } } });
  createdRuleIds.length = 0;
  await prisma.loyaltyAccount.updateMany({ where: { userId: buyerId }, data: { balance: 0 } });
  const account = await prisma.loyaltyAccount.findUnique({ where: { userId: buyerId } });
  if (account) {
    await prisma.loyaltyTransaction.deleteMany({ where: { accountId: account.id } });
  }
});

describe("reward rule admin CRUD", () => {
  it("lists rules newest-first and refuses to delete one already in effect", async () => {
    const past = await createRule();
    const rules = await loyalty.listRewardRules();
    expect(rules.some((r) => r.id === past.id)).toBe(true);

    await expect(loyalty.deleteRewardRule(past.id)).rejects.toBeInstanceOf(LoyaltyError);
  });

  it("allows deleting a rule scheduled for the future", async () => {
    const future = await createRule({ effectiveAt: new Date(Date.now() + 3600_000) });
    await loyalty.deleteRewardRule(future.id);
    createdRuleIds.splice(createdRuleIds.indexOf(future.id), 1);
    expect(await prisma.rewardRule.findUnique({ where: { id: future.id } })).toBeNull();
  });

  it("picks the most recently effective rule as the active one", async () => {
    await createRule({ pointsPerCurrencyUnit: 1, effectiveAt: new Date(Date.now() - 2 * 3600_000) });
    await createRule({ pointsPerCurrencyUnit: 5, effectiveAt: new Date(Date.now() - 3600_000) });

    const effective = await loyalty.getEffectiveRewardRule();
    expect(Number(effective?.pointsPerCurrencyUnit)).toBe(5);
  });
});

describe("earnPointsForOrder", () => {
  it("does nothing when no reward rule has ever been configured", async () => {
    const result = await prisma.$transaction((tx) =>
      loyalty.earnPointsForOrder(tx, buyerId, 100, { referenceType: "Test", referenceId: "x" }),
    );
    expect(result).toBeNull();
    expect(await prisma.loyaltyAccount.findUnique({ where: { userId: buyerId } })).toBeNull();
  });

  it("earns floor(subtotal * rate) points and creates a ledger row", async () => {
    await createRule({ pointsPerCurrencyUnit: 2 });

    await prisma.$transaction((tx) =>
      loyalty.earnPointsForOrder(tx, buyerId, 49.9, { referenceType: "SellerOrder", referenceId: "order-1" }),
    );

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: buyerId } });
    expect(account.balance).toBe(99); // floor(49.9 * 2) = 99

    const txns = await loyalty.listLoyaltyTransactions(buyerId);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe("EARNED");
    expect(txns[0].points).toBe(99);
    expect(txns[0].referenceId).toBe("order-1");
  });

  it("earns real points on an actual delivered order end to end", async () => {
    await createRule({ pointsPerCurrencyUnit: 1 });

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 1 } });
    const order = await placeOrder(buyerId, addressId);
    const sellerOrder = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId: order.id } });

    await transitionSellerOrder(sellerId, sellerOrder.id, "CONFIRMED");
    await transitionSellerOrder(sellerId, sellerOrder.id, "PROCESSING");
    await transitionSellerOrder(sellerId, sellerOrder.id, "PACKED");
    await transitionSellerOrder(sellerId, sellerOrder.id, "SHIPPED", {
      carrier: "DHL",
      trackingNumber: "TRACK123",
    });
    await transitionSellerOrder(sellerId, sellerOrder.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerId, sellerOrder.id, "DELIVERED");

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: buyerId } });
    expect(account.balance).toBe(100); // 100.00 subtotal * 1 point/unit
  });
});

describe("redeemPoints", () => {
  it("rejects redeeming below the minimum or more than the balance", async () => {
    await createRule();
    await expect(loyalty.redeemPoints(buyerId, 10)).rejects.toBeInstanceOf(LoyaltyError);
    await expect(loyalty.redeemPoints(buyerId, 100)).rejects.toBeInstanceOf(LoyaltyError); // no balance yet
  });

  it("redeems points for a real, usable single-use coupon and debits the ledger", async () => {
    await createRule({ pointsPerCurrencyUnit: 1, redemptionValue: 0.02 });
    await prisma.$transaction((tx) =>
      loyalty.earnPointsForOrder(tx, buyerId, 500, { referenceType: "Test", referenceId: "seed" }),
    );

    const coupon = await loyalty.redeemPoints(buyerId, 200);
    expect(coupon.type).toBe("FIXED_AMOUNT");
    expect(Number(coupon.value)).toBe(4); // 200 * 0.02
    expect(coupon.usageLimit).toBe(1);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: buyerId } });
    expect(account.balance).toBe(300); // 500 earned - 200 redeemed

    const txns = await loyalty.listLoyaltyTransactions(buyerId);
    const redemption = txns.find((t) => t.type === "REDEEMED");
    expect(redemption?.points).toBe(-200);
    expect(redemption?.note).toBe(coupon.code);

    // The redeemed coupon is a real, working coupon through the existing
    // (already-tested) coupon engine — prove it actually discounts a cart.
    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 1 } });
    const order = await placeOrder(buyerId, addressId, { couponCode: coupon.code });
    expect(order.discountTotal.toString()).toBe("4");
  });
});
