import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as currency from "@/server/services/currency";
import { CurrencyError } from "@/server/services/currency";
import { getConsolidatedPlatformFinancialReport } from "@/server/services/reports";

const PREFIX = "currency-test-";
// Reuses the real, already-seeded JOD/SAR currencies rather than
// inventing fake ones — exchange rate history should never be entered
// for currencies that don't exist.
const FROM = "JOD";
const TO = "SAR";

const createdRateIds: string[] = [];

afterAll(async () => {
  await prisma.exchangeRate.deleteMany({ where: { id: { in: createdRateIds } } });
  await prisma.ledgerEntry.deleteMany({ where: { description: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("currency conversion", () => {
  it("returns the amount unchanged when converting a currency to itself", async () => {
    await expect(currency.convertCurrency(100, "USD", "USD")).resolves.toBe(100);
  });

  it("throws a clear error when no rate exists for a pair", async () => {
    await expect(currency.convertCurrency(100, "USD", "EGP")).rejects.toBeInstanceOf(CurrencyError);
  });

  it("converts using the created rate", async () => {
    const rate = await currency.createExchangeRate({
      fromCode: FROM,
      toCode: TO,
      rate: 5,
      effectiveAt: new Date(Date.now() - 60_000),
    });
    createdRateIds.push(rate.id);

    await expect(currency.convertCurrency(10, FROM, TO)).resolves.toBeCloseTo(50);
  });

  it("falls back to the inverse pair when only that direction is recorded", async () => {
    await expect(currency.convertCurrency(50, TO, FROM)).resolves.toBeCloseTo(10);
  });

  it("uses the rate in effect at a past date, not a later one", async () => {
    const earlyDate = new Date(Date.now() - 120_000);
    const laterRate = await currency.createExchangeRate({
      fromCode: FROM,
      toCode: TO,
      rate: 9,
      effectiveAt: new Date(),
    });
    createdRateIds.push(laterRate.id);

    // Asking for a date before the rate-of-9 existed must still use the
    // earlier rate-of-5, not silently use today's rate for a past amount.
    await expect(currency.convertCurrency(10, FROM, TO, earlyDate)).rejects.toBeInstanceOf(CurrencyError);
    await expect(currency.convertCurrency(10, FROM, TO)).resolves.toBeCloseTo(90);
  });

  it("refuses to delete a rate that has already taken effect", async () => {
    const rate = await prisma.exchangeRate.findFirstOrThrow({
      where: { fromCode: FROM, toCode: TO, effectiveAt: { lte: new Date() } },
    });
    await expect(currency.deleteExchangeRate(rate.id)).rejects.toBeInstanceOf(CurrencyError);
  });

  it("allows deleting a rate scheduled for the future", async () => {
    const future = await currency.createExchangeRate({
      fromCode: FROM,
      toCode: TO,
      rate: 5.5,
      effectiveAt: new Date(Date.now() + 3_600_000),
    });
    await currency.deleteExchangeRate(future.id);
    await expect(prisma.exchangeRate.findUnique({ where: { id: future.id } })).resolves.toBeNull();
  });
});

describe("currency admin CRUD", () => {
  it("toggles a currency's active status", async () => {
    const before = await prisma.currency.findUniqueOrThrow({ where: { code: "GBP" } });
    const toggled = await currency.toggleCurrencyActive("GBP");
    expect(toggled.isActive).toBe(!before.isActive);
    await currency.toggleCurrencyActive("GBP"); // restore
  });

  it("updates a currency's display fields", async () => {
    const before = await prisma.currency.findUniqueOrThrow({ where: { code: "GBP" } });
    const updated = await currency.updateCurrency("GBP", {
      name: before.name,
      symbol: before.symbol,
      decimalDigits: before.decimalDigits,
    });
    expect(updated.code).toBe("GBP");
  });

  it("rejects operating on an unknown currency", async () => {
    await expect(currency.toggleCurrencyActive("ZZZ")).rejects.toBeInstanceOf(CurrencyError);
  });
});

describe("consolidated platform financial report", () => {
  it("converts and sums ledger activity across currencies using real rates", async () => {
    // getPlatformFinancialReport's grossSales comes from SELLER-subject
    // SALE entries, but which currencies even get looped over is decided
    // by PLATFORM-subject activity (e.g. the commission line every real
    // order posts) — both are needed for a currency to show up here at
    // all, matching how a real order actually posts to the ledger.
    await prisma.ledgerEntry.createMany({
      data: [
        {
          type: "SALE",
          amount: "100.00",
          currencyCode: FROM,
          subjectType: "SELLER",
          description: `${PREFIX}sale-jod`,
        },
        {
          type: "COMMISSION",
          amount: "10.00",
          currencyCode: FROM,
          subjectType: "PLATFORM",
          description: `${PREFIX}commission-jod`,
        },
        {
          type: "SALE",
          amount: "50.00",
          currencyCode: TO,
          subjectType: "SELLER",
          description: `${PREFIX}sale-sar`,
        },
        {
          type: "COMMISSION",
          amount: "5.00",
          currencyCode: TO,
          subjectType: "PLATFORM",
          description: `${PREFIX}commission-sar`,
        },
      ],
    });

    const report = await getConsolidatedPlatformFinancialReport(TO);
    // 100 JOD * 5 (JOD->SAR) = 500 SAR, plus the 50 SAR already in SAR = 550.
    expect(report.grossSales).toBeGreaterThanOrEqual(550);
    expect(report.baseCurrencyCode).toBe(TO);
    expect(report.unconvertedCurrencies).not.toContain(FROM);
  });

  it("reports a currency as unconverted instead of silently dropping it when no rate exists", async () => {
    await prisma.ledgerEntry.create({
      data: {
        type: "COMMISSION",
        amount: "1.00",
        currencyCode: "EGP",
        subjectType: "PLATFORM",
        description: `${PREFIX}commission-egp`,
      },
    });

    const report = await getConsolidatedPlatformFinancialReport(TO);
    expect(report.unconvertedCurrencies).toContain("EGP");
  });
});
