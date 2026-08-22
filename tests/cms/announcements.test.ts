import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as cms from "@/server/services/cms";
import { CmsError } from "@/server/services/cms";

const createdIds: string[] = [];

afterAll(async () => {
  await prisma.cmsBlock.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

async function create(content: Parameters<typeof cms.createAnnouncement>[0]) {
  const row = await cms.createAnnouncement(content);
  createdIds.push(row.id);
  return row;
}

describe("announcement bar", () => {
  it("shows the right language for the requested locale", async () => {
    const row = await create({ textEn: "Free shipping today", textAr: "شحن مجاني اليوم" });

    const en = await cms.getActiveAnnouncement("en");
    const ar = await cms.getActiveAnnouncement("ar");
    expect(en?.id).toBe(row.id);
    expect(en?.text).toBe("Free shipping today");
    expect(ar?.text).toBe("شحن مجاني اليوم");

    await cms.deleteAnnouncement(row.id);
  });

  it("hides an announcement outside its date range", async () => {
    const past = await create({
      textEn: "Expired sale",
      textAr: "عرض منتهي",
      startDate: "2020-01-01",
      endDate: "2020-01-31",
    });

    const active = await cms.getActiveAnnouncement("en");
    expect(active).toBeNull();

    await cms.deleteAnnouncement(past.id);
  });

  it("shows an announcement whose date range covers today", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const current = await create({
      textEn: "Live sale",
      textAr: "عرض حالي",
      startDate: yesterday,
      endDate: tomorrow,
    });

    const active = await cms.getActiveAnnouncement("en");
    expect(active?.id).toBe(current.id);

    await cms.deleteAnnouncement(current.id);
  });

  it("prefers the higher-priority (lower sortOrder) announcement", async () => {
    const first = await create({ textEn: "First", textAr: "الأول" });
    const second = await create({ textEn: "Second", textAr: "الثاني" });

    const active = await cms.getActiveAnnouncement("en");
    expect(active?.id).toBe(first.id);

    // Move `second` above `first`.
    await cms.reorderAnnouncement(second.id, "up");
    const activeAfterReorder = await cms.getActiveAnnouncement("en");
    expect(activeAfterReorder?.id).toBe(second.id);

    await cms.deleteAnnouncement(first.id);
    await cms.deleteAnnouncement(second.id);
  });

  it("skips a disabled announcement even if it's the highest priority", async () => {
    const disabled = await create({ textEn: "Disabled", textAr: "معطل" });
    const enabled = await create({ textEn: "Enabled", textAr: "مفعل" });
    await cms.toggleAnnouncementActive(disabled.id);

    const active = await cms.getActiveAnnouncement("en");
    expect(active?.id).toBe(enabled.id);

    await cms.deleteAnnouncement(disabled.id);
    await cms.deleteAnnouncement(enabled.id);
  });

  it("rejects operating on an unknown announcement", async () => {
    await expect(
      cms.updateAnnouncement("00000000-0000-0000-0000-000000000000", {
        textEn: "x",
        textAr: "x",
      }),
    ).rejects.toBeInstanceOf(CmsError);
  });
});
