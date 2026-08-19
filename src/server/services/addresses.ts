import "server-only";
import { prisma } from "@/server/db";

export class AddressError extends Error {}

export function listAddressesForUser(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function getAddressForUser(userId: string, id: string) {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) {
    throw new AddressError("Address not found.");
  }
  return address;
}

interface AddressInput {
  label?: string;
  fullName: string;
  phone: string;
  countryCode: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  isDefault: boolean;
}

async function clearDefault(userId: string) {
  await prisma.address.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
}

export async function createAddress(userId: string, input: AddressInput) {
  const isFirst = (await prisma.address.count({ where: { userId } })) === 0;
  const makeDefault = input.isDefault || isFirst;
  if (makeDefault) await clearDefault(userId);

  return prisma.address.create({
    data: { userId, ...input, isDefault: makeDefault },
  });
}

export async function updateAddress(userId: string, id: string, input: AddressInput) {
  await getAddressForUser(userId, id);
  if (input.isDefault) await clearDefault(userId);

  return prisma.address.update({
    where: { id },
    data: { ...input },
  });
}

export async function deleteAddress(userId: string, id: string) {
  const address = await getAddressForUser(userId, id);
  await prisma.address.delete({ where: { id } });

  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}

export async function setDefaultAddress(userId: string, id: string) {
  await getAddressForUser(userId, id);
  await clearDefault(userId);
  await prisma.address.update({ where: { id }, data: { isDefault: true } });
}
