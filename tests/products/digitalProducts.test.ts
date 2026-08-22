import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { placeOrder } from "@/server/services/checkout";
import {
  setDigitalFile,
  getDownloadUrlForOrderItem,
  getDigitalFileForSeller,
  DigitalProductError,
} from "@/server/services/digitalProducts";
import { verifyLocalDownloadToken } from "@/server/storage/local";
import { ForbiddenError } from "@/server/rbac";

const PREFIX = "digital-product-test-";

let categoryId: string;
let sellerId: string;
let otherSellerId: string;
let digitalProductId: string;
let buyerId: string;
let otherUserId: string;
let addressId: string;

async function attachFile(productId: string) {
  return setDigitalFile(sellerId, productId, {
    storageKey: `digital-products/${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
    fileName: "ebook.pdf",
    fileSizeBytes: 1024,
    contentType: "application/pdf",
  });
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const [sellerUser, otherSellerUser, buyer, otherUser] = await Promise.all([
    prisma.user.create({
      data: { email: `${PREFIX}seller-${Date.now()}@example.com`, firstName: "Digital", lastName: "Seller", passwordHash: "unused" },
    }),
    prisma.user.create({
      data: { email: `${PREFIX}other-seller-${Date.now()}@example.com`, firstName: "Other", lastName: "Seller", passwordHash: "unused" },
    }),
    prisma.user.create({
      data: { email: `${PREFIX}buyer-${Date.now()}@example.com`, firstName: "Digital", lastName: "Buyer", passwordHash: "unused" },
    }),
    prisma.user.create({
      data: { email: `${PREFIX}other-user-${Date.now()}@example.com`, firstName: "Other", lastName: "User", passwordHash: "unused" },
    }),
  ]);
  buyerId = buyer.id;
  otherUserId = otherUser.id;

  const [seller, otherSeller] = await Promise.all([
    prisma.seller.create({
      data: { userId: sellerUser.id, storeSlug: `${PREFIX}store-${Date.now()}`, storeName: "Digital Test Store", countryCode: "JO", status: "APPROVED" },
    }),
    prisma.seller.create({
      data: { userId: otherSellerUser.id, storeSlug: `${PREFIX}other-store-${Date.now()}`, storeName: "Other Store", countryCode: "JO", status: "APPROVED" },
    }),
  ]);
  sellerId = seller.id;
  otherSellerId = otherSeller.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "DIGI-1",
      name: "Digital Test Product",
      type: "DIGITAL",
      price: "29.99",
      costPrice: "5.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  digitalProductId = product.id;

  const address = await prisma.address.create({
    data: {
      userId: buyerId,
      fullName: "Digital Buyer",
      phone: "+962700000003",
      countryCode: "JO",
      city: "Amman",
      addressLine1: "1 Digital Street",
      isDefault: true,
    },
  });
  addressId = address.id;
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { userId: buyerId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.orderItem.deleteMany({ where: { sellerOrder: { orderId: { in: orderIds } } } });
  await prisma.sellerOrder.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { productId: digitalProductId } });
  await prisma.cart.deleteMany({ where: { userId: buyerId } });
  await prisma.digitalProductFile.deleteMany({ where: { productId: digitalProductId } });
  await prisma.product.deleteMany({ where: { id: digitalProductId } });
  await prisma.address.deleteMany({ where: { id: addressId } });
  await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("setDigitalFile", () => {
  it("attaches a file to the seller's own digital product", async () => {
    const file = await attachFile(digitalProductId);
    expect(file.fileName).toBe("ebook.pdf");

    const fetched = await getDigitalFileForSeller(sellerId, digitalProductId);
    expect(fetched?.id).toBe(file.id);
  });

  it("refuses to attach a file to another seller's product", async () => {
    await expect(
      setDigitalFile(otherSellerId, digitalProductId, {
        storageKey: "x",
        fileName: "x.pdf",
        fileSizeBytes: 1,
        contentType: "application/pdf",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses to attach a file to a non-digital product", async () => {
    const physical = await prisma.product.create({
      data: {
        sellerId,
        categoryId,
        slug: `${PREFIX}physical-${Date.now()}`,
        sku: "DIGI-PHYS-1",
        name: "Physical control",
        price: "10.00",
        costPrice: "5.00",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    });
    await expect(
      setDigitalFile(sellerId, physical.id, {
        storageKey: "x",
        fileName: "x.pdf",
        fileSizeBytes: 1,
        contentType: "application/pdf",
      }),
    ).rejects.toBeInstanceOf(DigitalProductError);
    await prisma.product.delete({ where: { id: physical.id } });
  });
});

describe("checkout with a digital product", () => {
  it("places the order without any Inventory row (no physical stock to reserve)", async () => {
    await attachFile(digitalProductId);
    expect(await prisma.inventory.count({ where: { productId: digitalProductId } })).toBe(0);

    const cart = await prisma.cart.upsert({
      where: { userId: buyerId },
      update: {},
      create: { userId: buyerId, currencyCode: "USD" },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: digitalProductId, quantity: 1 } });

    const order = await placeOrder(buyerId, addressId);
    expect(order.subtotal.toString()).toBe("29.99");
    expect(await prisma.inventory.count({ where: { productId: digitalProductId } })).toBe(0);
  });
});

describe("getDownloadUrlForOrderItem", () => {
  it("gives the buyer a real, verifiable signed URL and rejects everyone else", async () => {
    await attachFile(digitalProductId);
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { productId: digitalProductId } });

    const { url, fileName } = await getDownloadUrlForOrderItem(buyerId, orderItem.id);
    expect(fileName).toBe("ebook.pdf");
    const token = new URL(url, "http://localhost").searchParams.get("token")!;
    const payload = await verifyLocalDownloadToken(token);
    expect(payload?.fileName).toBe("ebook.pdf");

    await expect(getDownloadUrlForOrderItem(otherUserId, orderItem.id)).rejects.toBeInstanceOf(
      DigitalProductError,
    );
  });

  it("rejects a tampered token", async () => {
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { productId: digitalProductId } });
    const { url } = await getDownloadUrlForOrderItem(buyerId, orderItem.id);
    const token = new URL(url, "http://localhost").searchParams.get("token")!;
    expect(await verifyLocalDownloadToken(`${token}tampered`)).toBeNull();
  });

  it("refuses once the seller order is cancelled", async () => {
    const orderItem = await prisma.orderItem.findFirstOrThrow({
      where: { productId: digitalProductId },
      include: { sellerOrder: true },
    });
    await prisma.sellerOrder.update({ where: { id: orderItem.sellerOrderId }, data: { status: "CANCELLED" } });

    await expect(getDownloadUrlForOrderItem(buyerId, orderItem.id)).rejects.toBeInstanceOf(
      DigitalProductError,
    );

    await prisma.sellerOrder.update({ where: { id: orderItem.sellerOrderId }, data: { status: "PENDING" } });
  });
});
