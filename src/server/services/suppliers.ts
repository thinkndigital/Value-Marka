import "server-only";
import { prisma } from "@/server/db";
import { assertSellerOwns } from "@/server/rbac";

export class SupplierError extends Error {}

export function listSuppliersForSeller(sellerId: string) {
  return prisma.supplier.findMany({ where: { sellerId }, orderBy: { companyName: "asc" } });
}

export async function getSupplierForSeller(sellerId: string, id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new SupplierError("Supplier not found.");
  assertSellerOwns(supplier.sellerId, sellerId);
  return supplier;
}

interface SupplierInput {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  address?: string;
  paymentTerms?: string;
}

export function createSupplier(sellerId: string, input: SupplierInput) {
  return prisma.supplier.create({ data: { sellerId, ...input } });
}

export async function updateSupplier(sellerId: string, id: string, input: SupplierInput) {
  await getSupplierForSeller(sellerId, id);
  return prisma.supplier.update({ where: { id }, data: input });
}

export async function deleteSupplier(sellerId: string, id: string) {
  await getSupplierForSeller(sellerId, id);
  const openPurchaseOrders = await prisma.purchaseOrder.count({
    where: { supplierId: id, status: { in: ["DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED"] } },
  });
  if (openPurchaseOrders > 0) {
    throw new SupplierError("This supplier has open purchase orders and can't be deleted.");
  }
  await prisma.supplier.delete({ where: { id } });
}
