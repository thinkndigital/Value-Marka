import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getSellerFinancialReport, getPlatformFinancialReport } from "@/server/services/reports";
import { createExpense, deleteExpense } from "@/server/services/expenses";

// Financial reports are pure derivations over LedgerEntry/Expense/OrderItem
// — no mutable balance column anywhere (DATABASE.md §6) — so this seeds
// real ledger rows and a real delivered order line, then checks the report
// arithmetic against hand-computed expectations.

const PREFIX = "reports-test-";

let sellerId: string;
let categoryId: string;
let productId: string;
let sellerOrderId: string;
let orderItemId: string;
let ledgerIds: string[] = [];
let platformBaseline: { commission: number; grossSales: number };

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `${PREFIX}category`, slug: `${PREFIX}category-${Date.now()}` },
  });
  categoryId = category.id;

  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${Date.now()}@example.com`,
      firstName: "Reports",
      lastName: "Seller",
      passwordHash: "unused",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      storeSlug: `${PREFIX}store-${Date.now()}`,
      storeName: "Reports Test Store",
      countryCode: "JO",
      status: "APPROVED",
    },
  });
  sellerId = seller.id;

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId,
      slug: `${PREFIX}product-${Date.now()}`,
      sku: "RPT-1",
      name: "Reports Test Product",
      price: "50.00",
      costPrice: "20.00",
      currencyCode: "USD",
      status: "ACTIVE",
    },
  });
  productId = product.id;

  // A real delivered order (Order → SellerOrder → OrderItem), the shape
  // COGS is computed from — bypassing checkout since this test only needs
  // the fulfilled-order row shape, not the checkout flow itself (that's
  // covered in tests/checkout).
  const buyer = await prisma.user.create({
    data: {
      email: `${PREFIX}buyer-${Date.now()}@example.com`,
      firstName: "Reports",
      lastName: "Buyer",
      passwordHash: "unused",
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}order-${Date.now()}`,
      userId: buyer.id,
      status: "DELIVERED",
      currencyCode: "USD",
      subtotal: "150.00",
      grandTotal: "150.00",
    },
  });
  const sellerOrder = await prisma.sellerOrder.create({
    data: { orderId: order.id, sellerId, status: "DELIVERED", subtotal: "150.00" },
  });
  sellerOrderId = sellerOrder.id;
  const orderItem = await prisma.orderItem.create({
    data: {
      sellerOrderId,
      productId,
      nameSnapshot: product.name,
      skuSnapshot: product.sku,
      quantity: 3,
      unitPrice: "50.00",
      unitCostPrice: "20.00",
      lineTotal: "150.00",
    },
  });
  orderItemId = orderItem.id;

  // getPlatformFinancialReport aggregates across every seller — the test
  // database is shared with other test files that may run concurrently
  // and post their own ledger entries, so the platform test below asserts
  // deltas against this baseline rather than absolute totals.
  const baselineReport = await getPlatformFinancialReport("USD");
  platformBaseline = { commission: baselineReport.commission, grossSales: baselineReport.grossSales };

  const entries = await prisma.ledgerEntry.createManyAndReturn({
    data: [
      {
        type: "SALE",
        amount: "150.00",
        currencyCode: "USD",
        subjectType: "SELLER",
        subjectId: sellerId,
        referenceType: "SellerOrder",
        referenceId: sellerOrderId,
      },
      {
        type: "COMMISSION",
        amount: "-15.00",
        currencyCode: "USD",
        subjectType: "SELLER",
        subjectId: sellerId,
        referenceType: "SellerOrder",
        referenceId: sellerOrderId,
      },
      {
        type: "COMMISSION",
        amount: "15.00",
        currencyCode: "USD",
        subjectType: "PLATFORM",
        subjectId: null,
        referenceType: "SellerOrder",
        referenceId: sellerOrderId,
      },
    ],
  });
  ledgerIds = entries.map((e) => e.id);
});

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: ledgerIds } } });
  await prisma.orderItem.deleteMany({ where: { id: orderItemId } });
  await prisma.sellerOrder.deleteMany({ where: { id: sellerOrderId } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("getSellerFinancialReport", () => {
  it("computes sales, commission, COGS, and profit from real ledger + order-item rows", async () => {
    const report = await getSellerFinancialReport(sellerId, "USD");

    expect(report.grossSales).toBe(150);
    expect(report.commission).toBe(-15);
    expect(report.cogs).toBe(60); // 3 × 20.00
    expect(report.netSales).toBe(150); // no refunds/discounts yet
    expect(report.grossProfit).toBe(90); // 150 - 60
    expect(report.netProfit).toBe(75); // 90 - 15 commission - 0 expenses
    expect(report.payableBalance).toBe(135); // 150 - 15
  });

  it("an expense reduces net profit and payable balance, and is reversed on delete", async () => {
    const expense = await createExpense(sellerId, {
      category: "SOFTWARE",
      amount: 25,
      currencyCode: "USD",
    });

    const withExpense = await getSellerFinancialReport(sellerId, "USD");
    expect(withExpense.expenses).toBe(25);
    expect(withExpense.netProfit).toBe(50); // 75 - 25
    expect(withExpense.payableBalance).toBe(110); // 135 - 25

    await deleteExpense(sellerId, expense.id);

    const afterDelete = await getSellerFinancialReport(sellerId, "USD");
    expect(afterDelete.expenses).toBe(0);
    expect(afterDelete.payableBalance).toBe(135);
  });

  it("scopes a date range to only ledger/order activity inside it", async () => {
    const future = { from: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) };
    const report = await getSellerFinancialReport(sellerId, "USD", future);
    expect(report.grossSales).toBe(0);
    expect(report.cogs).toBe(0);
  });
});

describe("getPlatformFinancialReport", () => {
  it("reports commission revenue and the marketplace-wide gross sales it was earned on", async () => {
    const report = await getPlatformFinancialReport("USD");
    // Deltas against the pre-seed baseline, not absolute totals — this is
    // a genuinely system-wide aggregate over a database other test files
    // also write real USD ledger rows into.
    expect(report.commission - platformBaseline.commission).toBe(15);
    expect(report.grossSales - platformBaseline.grossSales).toBe(150);
  });
});
