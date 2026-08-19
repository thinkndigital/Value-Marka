import "server-only";
import { prisma } from "@/server/db";

export class WarehouseError extends Error {}

export function listWarehousesForSeller(sellerId: string) {
  return prisma.warehouse.findMany({
    where: { sellerId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getDefaultWarehouse(sellerId: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { sellerId, isDefault: true, isActive: true },
  });
  if (warehouse) return warehouse;

  // Fall back to the oldest active warehouse if no default is flagged —
  // keeps product creation working even if a seller un-defaulted all of
  // them without designating a new one.
  return prisma.warehouse.findFirst({
    where: { sellerId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createWarehouse(
  sellerId: string,
  input: { name: string; countryCode: string; city: string; addressLine?: string },
  makeDefault = false,
) {
  if (makeDefault) {
    await prisma.warehouse.updateMany({
      where: { sellerId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.warehouse.create({
    data: {
      sellerId,
      name: input.name,
      countryCode: input.countryCode,
      city: input.city,
      addressLine: input.addressLine,
      isDefault: makeDefault,
    },
  });
}
