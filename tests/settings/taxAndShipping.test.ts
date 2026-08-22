import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as settings from "@/server/services/settings";
import { SettingsError } from "@/server/services/settings";
import { placeOrder } from "@/server/services/checkout";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";

// Separate country (EG) from the shared checkout.test.ts fixtures (JO) so
// creating real, active tax/shipping rows here can't change that other
// file's totals if the two run concurrently.
const PREFIX = "settings-test-";
const COUNTRY = "EG";

let buyerId: string;
let addressId: string;
let sellerId: string;
let warehouseId: string;
let categoryId: string;
let productId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [buyer, sellerUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Settings",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-${Date.now()}@example.com`,
        firstName: "Settings",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Settings Buyer",
      phone: "+201000000000",
      countryCode: COUNTRY,
      city: "Cairo",
      addressLine1: "1 Test Street",
      isDefault: true,
    },
  });
  addressId = address.id;

  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Settings Test Store",
      countryCode: COUNTRY,
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const warehouse = await prisma.warehouse.create({
    data: { sellerId, name: "Settings Warehouse", countryCode: COUNTRY, city: "Cairo" },
  });
  warehouseId = warehouse.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "SET-1",
      name: "Settings Test Product",
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
    quantity: 10,
    reason: "test opening stock",
  });
});

afterAll(async () => {
  await prisma.taxRule.deleteMany({ where: { countryCode: COUNTRY } });
  await prisma.shippingMethod.deleteMany({ where: { zone: { countryCode: COUNTRY } } });
  await prisma.shippingZone.deleteMany({ where: { countryCode: COUNTRY } });

  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { product: { id: productId } } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
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

async function freshCart() {
  await prisma.cartItem.deleteMany({ where: { product: { id: productId } } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  const cart = await prisma.cart.create({ data: { userId: buyerId, currencyCode: "USD" } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 1 } });
}

describe("tax rule admin CRUD", () => {
  let ruleId: string;

  it("creates a tax rule", async () => {
    const rule = await settings.createTaxRule({
      countryCode: COUNTRY,
      name: "Settings test VAT",
      rate: 0.14,
      appliesTo: "ALL",
    });
    ruleId = rule.id;
    expect(Number(rule.rate)).toBeCloseTo(0.14);
    expect(rule.isActive).toBe(true);
  });

  it("updates a tax rule", async () => {
    const updated = await settings.updateTaxRule(ruleId, {
      countryCode: COUNTRY,
      name: "Settings test VAT (updated)",
      rate: 0.15,
      appliesTo: "ALL",
    });
    expect(Number(updated.rate)).toBeCloseTo(0.15);
  });

  it("toggles a tax rule off and on", async () => {
    const disabled = await settings.toggleTaxRuleActive(ruleId);
    expect(disabled.isActive).toBe(false);
    const reenabled = await settings.toggleTaxRuleActive(ruleId);
    expect(reenabled.isActive).toBe(true);
  });

  it("rejects operating on an unknown tax rule", async () => {
    await expect(settings.updateTaxRule("00000000-0000-0000-0000-000000000000", {
      countryCode: COUNTRY,
      name: "x",
      rate: 0.1,
      appliesTo: "ALL",
    })).rejects.toBeInstanceOf(SettingsError);
  });

  it("deletes a tax rule", async () => {
    await settings.deleteTaxRule(ruleId);
    await expect(prisma.taxRule.findUnique({ where: { id: ruleId } })).resolves.toBeNull();
  });
});

describe("shipping zone/method admin CRUD", () => {
  let zoneId: string;
  let methodId: string;

  it("creates a shipping zone", async () => {
    const zone = await settings.createShippingZone({ name: "Settings test zone", countryCode: COUNTRY });
    zoneId = zone.id;
    expect(zone.countryCode).toBe(COUNTRY);
  });

  it("refuses to delete a zone with methods", async () => {
    const method = await settings.createShippingMethod(zoneId, {
      name: "Standard",
      price: 5,
      freeThreshold: null,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
    });
    methodId = method.id;

    await expect(settings.deleteShippingZone(zoneId)).rejects.toBeInstanceOf(SettingsError);
  });

  it("updates and toggles a shipping method", async () => {
    const updated = await settings.updateShippingMethod(methodId, {
      name: "Standard (updated)",
      price: 7.5,
      freeThreshold: 200,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
    });
    expect(Number(updated.price)).toBeCloseTo(7.5);

    const disabled = await settings.toggleShippingMethodActive(methodId);
    expect(disabled.isActive).toBe(false);
    await settings.toggleShippingMethodActive(methodId);
  });

  it("deletes the method, then the now-empty zone", async () => {
    await settings.deleteShippingMethod(methodId);
    await settings.deleteShippingZone(zoneId);
    await expect(prisma.shippingZone.findUnique({ where: { id: zoneId } })).resolves.toBeNull();
  });
});

describe("checkout picks up admin-configured tax and shipping in real time", () => {
  it("charges zero tax/shipping for a country with no active rules", async () => {
    await freshCart();
    const order = await placeOrder(buyerId, addressId);
    expect(Number(order.taxTotal)).toBe(0);
    expect(Number(order.shippingTotal)).toBe(0);
  });

  it("charges the admin-configured tax rate and shipping price once created", async () => {
    await settings.createTaxRule({ countryCode: COUNTRY, name: "VAT", rate: 0.1, appliesTo: "ALL" });
    const zone = await settings.createShippingZone({ name: "Zone", countryCode: COUNTRY });
    await settings.createShippingMethod(zone.id, {
      name: "Standard",
      price: 12,
      freeThreshold: null,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
    });

    await freshCart();
    const order = await placeOrder(buyerId, addressId);

    // subtotal 100 * 10% tax = 10; shipping flat 12; grand = 100 - 0 + 10 + 12
    expect(Number(order.taxTotal)).toBeCloseTo(10);
    expect(Number(order.shippingTotal)).toBeCloseTo(12);
    expect(Number(order.grandTotal)).toBeCloseTo(122);
  });

  it("applies the free-shipping threshold once the subtotal clears it", async () => {
    const zone = await prisma.shippingZone.findFirstOrThrow({ where: { countryCode: COUNTRY } });
    const method = await prisma.shippingMethod.findFirstOrThrow({ where: { zoneId: zone.id } });
    await settings.updateShippingMethod(method.id, {
      name: method.name,
      price: Number(method.price),
      freeThreshold: 50, // subtotal (100) is above this
      estimatedDaysMin: null,
      estimatedDaysMax: null,
    });

    await freshCart();
    const order = await placeOrder(buyerId, addressId);

    expect(Number(order.shippingTotal)).toBe(0);
  });

  it("stops charging tax the moment the rule is disabled", async () => {
    const rule = await prisma.taxRule.findFirstOrThrow({ where: { countryCode: COUNTRY } });
    await settings.toggleTaxRuleActive(rule.id);

    await freshCart();
    const order = await placeOrder(buyerId, addressId);

    expect(Number(order.taxTotal)).toBe(0);
  });
});
