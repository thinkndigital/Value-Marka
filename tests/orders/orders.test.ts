import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { placeOrder } from "@/server/services/checkout";
import { recordInventoryMovementStandalone } from "@/server/services/inventory";
import {
  transitionSellerOrder,
  requestCustomerCancellation,
  requestReturn,
  OrderError,
} from "@/server/services/orders";
import { ForbiddenError } from "@/server/rbac";

// The order lifecycle state machine (DATABASE.md §5), verified end-to-end
// against the real database: legal/illegal transitions, seller isolation,
// inventory effects (reservation → sale on delivery, release on
// cancellation, restock on return), and the customer-facing cancel/return
// entry points.

const PREFIX = "orders-test-";

let buyerId: string;
let addressId: string;
let sellerAId: string;
let sellerBId: string;
let warehouseAId: string;
let warehouseBId: string;
let categoryId: string;
let productAId: string;
let productBId: string;
let inventoryAId: string;

async function createOrderWithBothSellers(quantityA = 1) {
  const cart = await prisma.cart.upsert({
    where: { userId: buyerId },
    update: {},
    create: { userId: buyerId, currencyCode: "USD" },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.createMany({
    data: [
      { cartId: cart.id, productId: productAId, quantity: quantityA },
      { cartId: cart.id, productId: productBId, quantity: 1 },
    ],
  });
  const order = await placeOrder(buyerId, addressId);
  const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: order.id } });
  const sellerOrderA = sellerOrders.find((so) => so.sellerId === sellerAId)!;
  const sellerOrderB = sellerOrders.find((so) => so.sellerId === sellerBId)!;
  return { order, sellerOrderA, sellerOrderB };
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [buyer, userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${PREFIX}buyer-${Date.now()}@example.com`,
        firstName: "Orders",
        lastName: "Buyer",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-a-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "A",
        passwordHash: "unused",
      },
    }),
    prisma.user.create({
      data: {
        email: `${PREFIX}seller-b-${Date.now()}@example.com`,
        firstName: "Seller",
        lastName: "B",
        passwordHash: "unused",
      },
    }),
  ]);
  buyerId = buyer.id;

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Orders Buyer",
      phone: "+962700000000",
      countryCode: "JO",
      city: "Amman",
      addressLine1: "1 Test Street",
      isDefault: true,
    },
  });
  addressId = address.id;

  const [sellerA, sellerB] = await Promise.all([
    prisma.seller.create({
      data: {
        userId: userA.id,
        storeSlug: `${PREFIX}store-a-${Date.now()}`,
        storeName: "Orders Test Store A",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
    prisma.seller.create({
      data: {
        userId: userB.id,
        storeSlug: `${PREFIX}store-b-${Date.now()}`,
        storeName: "Orders Test Store B",
        countryCode: "JO",
        status: "APPROVED",
      },
    }),
  ]);
  sellerAId = sellerA.id;
  sellerBId = sellerB.id;

  const [warehouseA, warehouseB] = await Promise.all([
    prisma.warehouse.create({
      data: { sellerId: sellerAId, name: "A Warehouse", countryCode: "JO", city: "Amman" },
    }),
    prisma.warehouse.create({
      data: { sellerId: sellerBId, name: "B Warehouse", countryCode: "JO", city: "Amman" },
    }),
  ]);
  warehouseAId = warehouseA.id;
  warehouseBId = warehouseB.id;

  const [productA, productB] = await Promise.all([
    prisma.product.create({
      data: {
        sellerId: sellerAId,
        categoryId,
        slug: `${PREFIX}product-a-${Date.now()}`,
        sku: "ORD-A-1",
        name: "Orders Test Product A",
        price: "20.00",
        costPrice: "10.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
    prisma.product.create({
      data: {
        sellerId: sellerBId,
        categoryId,
        slug: `${PREFIX}product-b-${Date.now()}`,
        sku: "ORD-B-1",
        name: "Orders Test Product B",
        price: "15.00",
        costPrice: "7.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    }),
  ]);
  productAId = productA.id;
  productBId = productB.id;

  const inventoryA = await recordInventoryMovementStandalone({
    productId: productAId,
    warehouseId: warehouseAId,
    type: "PURCHASE",
    quantity: 20,
    reason: "test opening stock",
  });
  inventoryAId = inventoryA.id;

  await recordInventoryMovementStandalone({
    productId: productBId,
    warehouseId: warehouseBId,
    type: "PURCHASE",
    quantity: 20,
    reason: "test opening stock",
  });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.refund.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.shipment.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { product: { id: { in: [productAId, productBId] } } } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  await prisma.inventoryMovement.deleteMany({
    where: { inventory: { productId: { in: [productAId, productBId] } } },
  });
  await prisma.inventory.deleteMany({ where: { productId: { in: [productAId, productBId] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productAId, productBId] } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseAId, warehouseBId] } } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerAId, sellerBId] } } });
  // A DELIVERED transition above can earn real loyalty points for buyerId
  // if loyalty.test.ts happens to have an active RewardRule at that moment
  // during parallel test-file execution — clean those up before the user,
  // or user.deleteMany fails on LoyaltyAccount's FK.
  await prisma.loyaltyTransaction.deleteMany({ where: { account: { userId: buyerId } } });
  await prisma.loyaltyAccount.deleteMany({ where: { userId: buyerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("transitionSellerOrder", () => {
  it("refuses to skip stages", async () => {
    const { sellerOrderA } = await createOrderWithBothSellers();
    await expect(
      transitionSellerOrder(sellerAId, sellerOrderA.id, "SHIPPED"),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("refuses to act on another seller's order", async () => {
    const { sellerOrderA } = await createOrderWithBothSellers();
    await expect(
      transitionSellerOrder(sellerBId, sellerOrderA.id, "CONFIRMED"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires a carrier and tracking number to ship", async () => {
    const { sellerOrderA } = await createOrderWithBothSellers();
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "CONFIRMED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PROCESSING");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PACKED");
    await expect(
      transitionSellerOrder(sellerAId, sellerOrderA.id, "SHIPPED"),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("walks the full happy path and converts the reservation into a real sale on delivery", async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });

    const { order, sellerOrderA, sellerOrderB } = await createOrderWithBothSellers(2);

    await transitionSellerOrder(sellerAId, sellerOrderA.id, "CONFIRMED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PROCESSING");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PACKED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "SHIPPED", {
      carrier: "Aramex",
      trackingNumber: "TRACK-123",
    });

    let refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    // Seller B hasn't shipped yet — the customer-facing order isn't
    // "shipped" until every seller's portion is.
    expect(refreshedOrder.status).toBe("PENDING");

    await transitionSellerOrder(sellerAId, sellerOrderA.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "DELIVERED");

    const afterDelivery = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    expect(afterDelivery.reserved).toBe(before.reserved); // released back to zero net change
    expect(afterDelivery.quantity).toBe(before.quantity - 2); // actually decremented now

    refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.status).toBe("PENDING"); // still gated by seller B

    await transitionSellerOrder(sellerBId, sellerOrderB.id, "CONFIRMED");
    await transitionSellerOrder(sellerBId, sellerOrderB.id, "PROCESSING");
    await transitionSellerOrder(sellerBId, sellerOrderB.id, "PACKED");
    await transitionSellerOrder(sellerBId, sellerOrderB.id, "SHIPPED", {
      carrier: "Aramex",
      trackingNumber: "TRACK-456",
    });
    await transitionSellerOrder(sellerBId, sellerOrderB.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerBId, sellerOrderB.id, "DELIVERED");

    refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.status).toBe("DELIVERED");
  });
});

describe("requestCustomerCancellation", () => {
  it("cancels only the seller portions that haven't started fulfillment yet, and releases their reservations", async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    const { order, sellerOrderA } = await createOrderWithBothSellers(3);

    // Seller A gets ahead of the customer's cancel request — once shipped,
    // that portion is no longer cancellable (PACKED still is, deliberately;
    // only SHIPPED and beyond locks cancellation out).
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "CONFIRMED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PROCESSING");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PACKED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "SHIPPED", {
      carrier: "Aramex",
      trackingNumber: "TRACK-CANCEL-TEST",
    });

    const result = await requestCustomerCancellation(buyerId, order.orderNumber);
    expect(result).toEqual({ cancelledCount: 1, totalCount: 2 }); // only seller B

    const refreshedA = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderA.id } });
    expect(refreshedA.status).toBe("SHIPPED"); // untouched — already in flight

    // Seller B's reservation was released; seller A's stays reserved.
    const afterCancel = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    expect(afterCancel.reserved).toBe(before.reserved + 3); // A's 3 units still held

    await expect(requestCustomerCancellation(buyerId, order.orderNumber)).rejects.toBeInstanceOf(
      OrderError,
    ); // nothing left to cancel

    // Clean up seller A's leftover reservation so it doesn't bleed into later tests.
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "DELIVERED");
  });
});

describe("requestReturn", () => {
  it("refuses to return an item that hasn't been delivered", async () => {
    const { order, sellerOrderA } = await createOrderWithBothSellers();
    await expect(
      requestReturn(buyerId, order.orderNumber, sellerOrderA.id, "Changed my mind"),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("moves a delivered item through RETURN_REQUESTED → RETURNED → REFUNDED and restocks it", async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    const { order, sellerOrderA } = await createOrderWithBothSellers(1);

    await transitionSellerOrder(sellerAId, sellerOrderA.id, "CONFIRMED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PROCESSING");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "PACKED");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "SHIPPED", {
      carrier: "Aramex",
      trackingNumber: "TRACK-789",
    });
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "OUT_FOR_DELIVERY");
    await transitionSellerOrder(sellerAId, sellerOrderA.id, "DELIVERED");

    const afterDelivery = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    expect(afterDelivery.quantity).toBe(before.quantity - 1);

    await requestReturn(buyerId, order.orderNumber, sellerOrderA.id, "Doesn't fit");

    let refreshed = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderA.id } });
    expect(refreshed.status).toBe("RETURN_REQUESTED");

    await transitionSellerOrder(sellerAId, sellerOrderA.id, "RETURNED");
    const afterReturn = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryAId } });
    expect(afterReturn.quantity).toBe(before.quantity); // restocked

    const refund = await prisma.refund.findFirstOrThrow({ where: { sellerOrderId: sellerOrderA.id } });
    expect(refund.status).toBe("APPROVED");

    await transitionSellerOrder(sellerAId, sellerOrderA.id, "REFUNDED");
    const refundedRefund = await prisma.refund.findFirstOrThrow({
      where: { sellerOrderId: sellerOrderA.id },
    });
    expect(refundedRefund.status).toBe("COMPLETED");

    refreshed = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderA.id } });
    expect(refreshed.status).toBe("REFUNDED");
  });
});
