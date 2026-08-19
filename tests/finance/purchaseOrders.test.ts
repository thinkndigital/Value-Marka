import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createPurchaseOrder,
  submitPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrderItems,
  markPurchaseOrderPaid,
  getPurchaseOrderForSeller,
  PurchaseOrderError,
} from "@/server/services/purchaseOrders";
import { ForbiddenError } from "@/server/rbac";

// Purchase order lifecycle, partial receiving, and the real inventory
// effect it has (a PURCHASE InventoryMovement for the *received* quantity,
// never the ordered quantity) — DATABASE.md §4 — verified against the real
// database. Also covers seller isolation on PO access.

const PREFIX = "po-test-";

let sellerId: string;
let otherSellerId: string;
let supplierId: string;
let warehouseId: string;
let categoryId: string;
let productId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [user, otherUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}${Date.now()}@example.com`,
        firstName: "PO",
        lastName: "Seller",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}other-${Date.now()}@example.com`,
        firstName: "PO",
        lastName: "OtherSeller",
        passwordHash: "unused",
      },
    }),
  ]);

  const [seller, otherSeller] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: user.id,
        storeSlug: `${PREFIX}store-${Date.now()}`,
        storeName: "PO Test Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: otherUser.id,
        storeSlug: `${PREFIX}other-store-${Date.now()}`,
        storeName: "PO Test Other Store",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerId = seller.id;
  otherSellerId = otherSeller.id;

  const [supplier, warehouse] = await Promise.all([
    prisma.supplier.create({ data: { sellerId, companyName: "PO Test Supplier" } }),
    prisma.warehouse.create({
      data: { sellerId, name: "PO Test Warehouse", countryCode: "JO", city: "Amman" },
    }),
  ]);
  supplierId = supplier.id;
  warehouseId = warehouse.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "PO-1",
      name: "PO Test Product",
      price: "20.00",
      costPrice: "8.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId } } });
  await prisma.inventory.deleteMany({ where: { productId } });
  await prisma.purchaseOrderItem.deleteMany({ where: { product: { id: productId } } });
  await prisma.purchaseOrder.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.supplier.deleteMany({ where: { sellerId: { in: [sellerId, otherSellerId] } } });
  await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

async function newDraftPo(quantityOrdered = 10) {
  return createPurchaseOrder(sellerId, {
    supplierId,
    warehouseId,
    currencyCode: "USD",
    items: [{ productId, quantityOrdered, unitCost: 8 }],
  });
}

describe("purchase order lifecycle", () => {
  it("refuses to receive against a draft PO", async () => {
    const po = await newDraftPo();
    await expect(
      receivePurchaseOrderItems(sellerId, po.id, [{ itemId: po.items[0].id, quantityReceived: 1 }], "tester"),
    ).rejects.toBeInstanceOf(PurchaseOrderError);
  });

  it("partially receives, then fully receives, creating one PURCHASE movement per receipt for the received quantity only", async () => {
    const po = await newDraftPo(10);
    await submitPurchaseOrder(sellerId, po.id);

    const afterFirst = await receivePurchaseOrderItems(
      sellerId,
      po.id,
      [{ itemId: po.items[0].id, quantityReceived: 4 }],
      "tester",
    );
    expect(afterFirst.status).toBe("PARTIALLY_RECEIVED");
    expect(afterFirst.items[0].quantityReceived).toBe(4);

    const inventory = await prisma.inventory.findFirstOrThrow({ where: { productId, warehouseId } });
    expect(inventory.quantity).toBe(4);

    const afterSecond = await receivePurchaseOrderItems(
      sellerId,
      po.id,
      [{ itemId: po.items[0].id, quantityReceived: 6 }],
      "tester",
    );
    expect(afterSecond.status).toBe("RECEIVED");
    expect(afterSecond.items[0].quantityReceived).toBe(10);

    const inventoryAfter = await prisma.inventory.findFirstOrThrow({ where: { productId, warehouseId } });
    expect(inventoryAfter.quantity).toBe(10); // 4 + 6, not 10 + 10

    const movements = await prisma.inventoryMovement.findMany({
      where: { inventory: { productId, warehouseId }, type: "PURCHASE", referenceId: po.id },
    });
    expect(movements.map((m) => m.quantity).sort()).toEqual([4, 6]);
  });

  it("refuses to receive more than remains on order", async () => {
    const po = await newDraftPo(5);
    await submitPurchaseOrder(sellerId, po.id);
    await expect(
      receivePurchaseOrderItems(sellerId, po.id, [{ itemId: po.items[0].id, quantityReceived: 6 }], "tester"),
    ).rejects.toBeInstanceOf(PurchaseOrderError);
  });

  it("cancels a submitted PO and refuses to receive against it afterward", async () => {
    const po = await newDraftPo(5);
    await submitPurchaseOrder(sellerId, po.id);
    await cancelPurchaseOrder(sellerId, po.id);

    await expect(
      receivePurchaseOrderItems(sellerId, po.id, [{ itemId: po.items[0].id, quantityReceived: 1 }], "tester"),
    ).rejects.toBeInstanceOf(PurchaseOrderError);
  });

  it("marks a PO paid exactly once and posts a PURCHASE ledger entry", async () => {
    const po = await newDraftPo(2);
    await markPurchaseOrderPaid(sellerId, po.id);

    const refreshed = await getPurchaseOrderForSeller(sellerId, po.id);
    expect(refreshed.paymentStatus).toBe("PAID");

    await expect(markPurchaseOrderPaid(sellerId, po.id)).rejects.toBeInstanceOf(PurchaseOrderError);

    const ledgerEntry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { referenceType: "PurchaseOrder", referenceId: po.id, type: "PURCHASE" },
    });
    expect(Number(ledgerEntry.amount)).toBe(-16); // 2 × 8.00
  });
});

describe("purchase order seller isolation", () => {
  it("refuses to let another seller read or act on this PO", async () => {
    const po = await newDraftPo(3);
    await expect(getPurchaseOrderForSeller(otherSellerId, po.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(submitPurchaseOrder(otherSellerId, po.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
