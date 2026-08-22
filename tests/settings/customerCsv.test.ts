import { describe, expect, it } from "vitest";
import { customersToCsv } from "@/server/services/customer-csv";

describe("customer CSV export", () => {
  it("produces a header row plus one row per customer, with real profile stats", () => {
    const csv = customersToCsv([
      {
        email: "buyer@example.com",
        firstName: "Real",
        lastName: "Buyer",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        orderCount: 3,
        lifetimeValue: 150.5,
        averageOrderValue: 50.17,
        currencyCode: "USD",
        lastOrderAt: new Date("2026-02-01T00:00:00Z"),
      },
    ]);

    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "email,firstName,lastName,createdAt,orderCount,lifetimeValue,averageOrderValue,currencyCode,lastOrderAt",
    );
    expect(lines[1]).toContain("buyer@example.com");
    expect(lines[1]).toContain("150.5");
  });

  it("never includes password/session/auth fields — only the columns it declares", () => {
    const csv = customersToCsv([
      {
        email: "buyer@example.com",
        firstName: "Real",
        lastName: "Buyer",
        createdAt: new Date(),
        orderCount: 0,
        lifetimeValue: 0,
        averageOrderValue: 0,
        currencyCode: null,
        lastOrderAt: null,
      },
    ]);
    expect(csv).not.toMatch(/password/i);
    expect(csv).not.toMatch(/token/i);
    expect(csv).not.toMatch(/session/i);
  });

  it("handles a customer with no orders yet without throwing", () => {
    const csv = customersToCsv([
      {
        email: "new@example.com",
        firstName: "New",
        lastName: "Customer",
        createdAt: new Date(),
        orderCount: 0,
        lifetimeValue: 0,
        averageOrderValue: 0,
        currencyCode: null,
        lastOrderAt: null,
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[1].endsWith(",")).toBe(true); // currencyCode and lastOrderAt both blank
  });

  it("returns just the header row for an empty customer list", () => {
    const csv = customersToCsv([]);
    expect(csv.trim().split("\n")).toHaveLength(1);
  });
});
