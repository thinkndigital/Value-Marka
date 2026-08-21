import "server-only";
import { prisma } from "@/server/db";

export class NavigationError extends Error {}

async function getOrCreateMenu(key: string) {
  const existing = await prisma.navigationMenu.findUnique({ where: { key } });
  if (existing) return existing;
  return prisma.navigationMenu.create({ data: { key } });
}

export async function getFooterNavItems() {
  const menu = await prisma.navigationMenu.findUnique({
    where: { key: "footer" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return menu?.items ?? [];
}

export interface NavItemInput {
  label: string;
  url: string;
}

export async function createFooterNavItem(input: NavItemInput) {
  const menu = await getOrCreateMenu("footer");
  const last = await prisma.navigationItem.findFirst({
    where: { menuId: menu.id },
    orderBy: { sortOrder: "desc" },
  });
  return prisma.navigationItem.create({
    data: { menuId: menu.id, label: input.label, url: input.url, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
}

async function getOwnedFooterItem(id: string) {
  const item = await prisma.navigationItem.findUnique({ where: { id }, include: { menu: true } });
  if (!item || item.menu.key !== "footer") throw new NavigationError("Navigation item not found.");
  return item;
}

export async function updateFooterNavItem(id: string, input: NavItemInput) {
  await getOwnedFooterItem(id);
  return prisma.navigationItem.update({ where: { id }, data: input });
}

export async function reorderFooterNavItem(id: string, direction: "up" | "down") {
  const item = await getOwnedFooterItem(id);
  const neighbor = await prisma.navigationItem.findFirst({
    where: {
      menuId: item.menuId,
      sortOrder: direction === "up" ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return item;

  await prisma.$transaction([
    prisma.navigationItem.update({ where: { id: item.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.navigationItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
  ]);
  return item;
}

export async function deleteFooterNavItem(id: string) {
  await getOwnedFooterItem(id);
  await prisma.navigationItem.delete({ where: { id } });
}
