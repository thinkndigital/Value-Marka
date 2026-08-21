import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createFooterNavItem,
  getFooterNavItems,
  updateFooterNavItem,
  reorderFooterNavItem,
  deleteFooterNavItem,
  NavigationError,
} from "@/server/services/navigation";

afterEach(async () => {
  const menu = await prisma.navigationMenu.findUnique({ where: { key: "footer" } });
  if (menu) await prisma.navigationItem.deleteMany({ where: { menuId: menu.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("footer navigation", () => {
  it("creates the footer menu on first use and appends items in order", async () => {
    const first = await createFooterNavItem({ label: "About", url: "/page/about" });
    const second = await createFooterNavItem({ label: "Terms", url: "/page/terms" });

    const items = await getFooterNavItems();
    expect(items.map((i) => i.id)).toEqual([first.id, second.id]);

    const menus = await prisma.navigationMenu.findMany({ where: { key: "footer" } });
    expect(menus).toHaveLength(1);
  });

  it("updates a nav item's label and url", async () => {
    const item = await createFooterNavItem({ label: "Old", url: "/old" });
    await updateFooterNavItem(item.id, { label: "New", url: "/new" });

    const items = await getFooterNavItems();
    const updated = items.find((i) => i.id === item.id);
    expect(updated?.label).toBe("New");
    expect(updated?.url).toBe("/new");
  });

  it("swaps sortOrder when reordering", async () => {
    const first = await createFooterNavItem({ label: "A", url: "/a" });
    const second = await createFooterNavItem({ label: "B", url: "/b" });

    await reorderFooterNavItem(second.id, "up");

    const items = await getFooterNavItems();
    expect(items.map((i) => i.id)).toEqual([second.id, first.id]);
  });

  it("deletes a nav item", async () => {
    const item = await createFooterNavItem({ label: "Gone", url: "/gone" });
    await deleteFooterNavItem(item.id);

    const items = await getFooterNavItems();
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it("refuses to update an item that doesn't belong to the footer menu", async () => {
    await expect(updateFooterNavItem("not-a-real-id", { label: "x", url: "/x" })).rejects.toBeInstanceOf(
      NavigationError,
    );
  });
});
