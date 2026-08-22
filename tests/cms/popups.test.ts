import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as cms from "@/server/services/cms";
import { CmsError } from "@/server/services/cms";

const createdIds: string[] = [];

afterAll(async () => {
  await prisma.cmsBlock.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

async function create(content: Parameters<typeof cms.createPopup>[0]) {
  const row = await cms.createPopup(content);
  createdIds.push(row.id);
  return row;
}

const base = {
  titleEn: "Welcome",
  titleAr: "أهلا",
  bodyEn: "Enjoy 10% off",
  bodyAr: "استمتع بخصم 10%",
  target: "ALL" as const,
};

describe("popups", () => {
  it("shows the right language for the requested locale", async () => {
    const row = await create(base);

    const en = await cms.getActivePopup("en", false);
    const ar = await cms.getActivePopup("ar", false);
    expect(en?.id).toBe(row.id);
    expect(en?.title).toBe("Welcome");
    expect(ar?.title).toBe("أهلا");

    await cms.deletePopup(row.id);
  });

  it("hides a popup outside its date range", async () => {
    const past = await create({
      ...base,
      startDate: "2020-01-01",
      endDate: "2020-01-31",
    });

    const active = await cms.getActivePopup("en", false);
    expect(active).toBeNull();

    await cms.deletePopup(past.id);
  });

  it("shows a popup whose date range covers today", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const current = await create({ ...base, startDate: yesterday, endDate: tomorrow });

    const active = await cms.getActivePopup("en", false);
    expect(active?.id).toBe(current.id);

    await cms.deletePopup(current.id);
  });

  it("prefers the higher-priority (lower sortOrder) popup", async () => {
    const first = await create(base);
    const second = await create(base);

    const active = await cms.getActivePopup("en", false);
    expect(active?.id).toBe(first.id);

    await cms.reorderPopup(second.id, "up");
    const activeAfterReorder = await cms.getActivePopup("en", false);
    expect(activeAfterReorder?.id).toBe(second.id);

    await cms.deletePopup(first.id);
    await cms.deletePopup(second.id);
  });

  it("skips a disabled popup even if it's the highest priority", async () => {
    const disabled = await create(base);
    const enabled = await create(base);
    await cms.togglePopupActive(disabled.id);

    const active = await cms.getActivePopup("en", false);
    expect(active?.id).toBe(enabled.id);

    await cms.deletePopup(disabled.id);
    await cms.deletePopup(enabled.id);
  });

  it("only shows a GUEST-targeted popup to signed-out visitors, and CUSTOMER-targeted to signed-in ones", async () => {
    const guestOnly = await create({ ...base, target: "GUEST" });

    expect((await cms.getActivePopup("en", false))?.id).toBe(guestOnly.id);
    expect(await cms.getActivePopup("en", true)).toBeNull();

    await cms.deletePopup(guestOnly.id);

    const customerOnly = await create({ ...base, target: "CUSTOMER" });
    expect(await cms.getActivePopup("en", false)).toBeNull();
    expect((await cms.getActivePopup("en", true))?.id).toBe(customerOnly.id);

    await cms.deletePopup(customerOnly.id);
  });

  it("an ALL-targeted popup shows to both guests and customers", async () => {
    const everyone = await create({ ...base, target: "ALL" });

    expect((await cms.getActivePopup("en", false))?.id).toBe(everyone.id);
    expect((await cms.getActivePopup("en", true))?.id).toBe(everyone.id);

    await cms.deletePopup(everyone.id);
  });

  it("rejects operating on an unknown popup", async () => {
    await expect(
      cms.updatePopup("00000000-0000-0000-0000-000000000000", base),
    ).rejects.toBeInstanceOf(CmsError);
  });
});
