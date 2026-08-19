/**
 * Seeds reference data that the platform cannot function without:
 * the permission catalog, the system roles from spec §34, and the
 * language/currency/country reference tables (spec §6/§7/§8 — real ISO
 * codes, never hardcoded in application logic).
 *
 * Deliberately NOT seeded here: tax rates, commission rates, shipping
 * rates — those are business decisions an admin configures, not facts to
 * fabricate.
 *
 * Run with `npm run db:seed` (also runs automatically after
 * `prisma migrate dev` via prisma.config.ts).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ─────────────────────────────────────────────────────────────────────────
// Permission catalog — "resource.action[.scope]" (spec §34 example:
// products.read, products.create, orders.refund, finance.read, ...).
// ─────────────────────────────────────────────────────────────────────────

const crud = (resource: string) => [
  `${resource}.read`,
  `${resource}.create`,
  `${resource}.update`,
  `${resource}.delete`,
];

const PERMISSIONS: Record<string, string> = Object.fromEntries(
  [
    // Catalog
    ...crud("products"),
    ...crud("categories"),
    ...crud("brands"),
    // Sellers
    ...crud("sellers"),
    "sellers.approve",
    "sellers.suspend",
    // Orders — the unscoped key is "this seller's own orders" (enforced by
    // sellerId filtering in the service layer); ".any" is the elevated,
    // cross-seller admin/support view (ARCHITECTURE.md §5).
    "orders.read",
    "orders.read.any",
    "orders.update",
    "orders.refund",
    // Inventory & supply chain
    ...crud("warehouses"),
    ...crud("inventory"),
    ...crud("suppliers"),
    ...crud("purchaseOrders"),
    ...crud("expenses"),
    // Finance
    "finance.read",
    "finance.read.any",
    "finance.export",
    ...crud("payouts"),
    "payouts.approve",
    "payouts.reject",
    // Marketing
    ...crud("coupons"),
    ...crud("campaigns"),
    "affiliates.read",
    "affiliates.manage",
    // CRM
    "customers.read",
    "customers.update",
    // CMS
    ...crud("cms"),
    // Platform administration
    ...crud("users"),
    ...crud("roles"),
    "settings.read",
    "settings.update",
    "reports.read",
    "reports.export",
    // Self-service (every authenticated user)
    "profile.update",
    "reviews.create",
  ].map((key) => [key, key]),
);

// ─────────────────────────────────────────────────────────────────────────
// Roles (spec §34)
// ─────────────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (key) => key !== "roles.delete",
);

const ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}[] = [
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Unrestricted platform access.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "ADMIN",
    name: "Admin",
    description: "Full operational access, excluding role deletion.",
    permissions: ADMIN_PERMISSIONS,
  },
  {
    key: "FINANCE",
    name: "Finance",
    description: "Ledger, payouts, and financial reporting.",
    permissions: [
      "finance.read",
      "finance.read.any",
      "finance.export",
      "payouts.read",
      "payouts.approve",
      "payouts.reject",
      "orders.read.any",
      "expenses.read",
      "expenses.create",
      "expenses.update",
      "reports.read",
      "reports.export",
    ],
  },
  {
    key: "MARKETING",
    name: "Marketing",
    description: "Campaigns, coupons, affiliates, and CMS content.",
    permissions: [
      ...crud("coupons"),
      ...crud("campaigns"),
      "affiliates.read",
      "affiliates.manage",
      "cms.read",
      "cms.update",
      "reports.read",
    ],
  },
  {
    key: "CUSTOMER_SUPPORT",
    name: "Customer Support",
    description: "Order and customer support across all sellers.",
    permissions: [
      "orders.read.any",
      "orders.update",
      "customers.read",
      "customers.update",
    ],
  },
  {
    key: "INVENTORY_MANAGER",
    name: "Inventory Manager",
    description: "Warehouses, stock movements, and purchasing.",
    permissions: [
      "products.read",
      ...crud("warehouses"),
      ...crud("inventory"),
      ...crud("suppliers"),
      ...crud("purchaseOrders"),
    ],
  },
  {
    key: "SELLER_MANAGER",
    name: "Seller Manager",
    description: "Seller onboarding, approval, and account management.",
    permissions: ["sellers.read", "sellers.update", "sellers.approve", "sellers.suspend"],
  },
  {
    key: "CONTENT_MANAGER",
    name: "Content Manager",
    description: "Homepage, CMS pages, categories, and brands.",
    permissions: [...crud("cms"), ...crud("categories"), ...crud("brands")],
  },
  {
    key: "ANALYST",
    name: "Analyst",
    description: "Read-only reporting access.",
    permissions: ["reports.read", "reports.export", "finance.read"],
  },
  {
    key: "SELLER",
    name: "Seller",
    description: "Manages their own store, products, orders, and payouts.",
    permissions: [
      ...crud("products"),
      "orders.read",
      "orders.update",
      ...crud("warehouses"),
      "inventory.read",
      "inventory.update",
      "payouts.read",
      "coupons.read",
      "coupons.create",
      "coupons.update",
      "profile.update",
    ],
  },
  {
    key: "AFFILIATE",
    name: "Affiliate",
    description: "Affiliate dashboard: links, clicks, and commissions.",
    permissions: ["affiliates.read", "profile.update"],
  },
  {
    key: "CUSTOMER",
    name: "Customer",
    description: "Shops, orders, and reviews.",
    permissions: ["orders.read", "reviews.create", "profile.update"],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Reference data: languages, currencies, countries (real ISO facts, not
// business data — spec §6/§7/§8).
// ─────────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", direction: "LTR" as const },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "RTL" as const },
];

const CURRENCIES = [
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا", decimalDigits: 3 },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", decimalDigits: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimalDigits: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimalDigits: 3 },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", decimalDigits: 2 },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب", decimalDigits: 3 },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", decimalDigits: 3 },
  { code: "EGP", name: "Egyptian Pound", symbol: "ج.م", decimalDigits: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalDigits: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalDigits: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalDigits: 2 },
];

const COUNTRIES = [
  { code: "JO", name: "Jordan", nameLocalized: "الأردن", currencyCode: "JOD", timezone: "Asia/Amman", phoneCode: "+962" },
  { code: "SA", name: "Saudi Arabia", nameLocalized: "المملكة العربية السعودية", currencyCode: "SAR", timezone: "Asia/Riyadh", phoneCode: "+966" },
  { code: "AE", name: "United Arab Emirates", nameLocalized: "الإمارات العربية المتحدة", currencyCode: "AED", timezone: "Asia/Dubai", phoneCode: "+971" },
  { code: "KW", name: "Kuwait", nameLocalized: "الكويت", currencyCode: "KWD", timezone: "Asia/Kuwait", phoneCode: "+965" },
  { code: "QA", name: "Qatar", nameLocalized: "قطر", currencyCode: "QAR", timezone: "Asia/Qatar", phoneCode: "+974" },
  { code: "BH", name: "Bahrain", nameLocalized: "البحرين", currencyCode: "BHD", timezone: "Asia/Bahrain", phoneCode: "+973" },
  { code: "OM", name: "Oman", nameLocalized: "عمان", currencyCode: "OMR", timezone: "Asia/Muscat", phoneCode: "+968" },
  { code: "EG", name: "Egypt", nameLocalized: "مصر", currencyCode: "EGP", timezone: "Africa/Cairo", phoneCode: "+20" },
];

// ─────────────────────────────────────────────────────────────────────────
// Homepage CMS blocks (spec §41) — real content rows, not hardcoded JSX.
// Editable here until Phase 8's admin builder exists.
// ─────────────────────────────────────────────────────────────────────────

const CMS_BLOCKS: {
  key: string;
  type: string;
  locale: string;
  sortOrder: number;
  content: Prisma.InputJsonValue;
}[] = [
  {
    key: "homepage.hero",
    type: "hero",
    locale: "en",
    sortOrder: 0,
    content: {
      kicker: "Value Marka",
      title: "Shop thousands of sellers, one marketplace.",
      subtitle:
        "Real stores, real stock, real prices — browse categories, compare sellers, and check out with confidence.",
      ctaPrimaryLabel: "Browse categories",
      ctaPrimaryHref: "/search",
      ctaSecondaryLabel: "Sell on Value Marka",
      ctaSecondaryHref: "/sell",
    },
  },
  {
    key: "homepage.hero",
    type: "hero",
    locale: "ar",
    sortOrder: 0,
    content: {
      kicker: "فاليو ماركة",
      title: "آلاف البائعين، سوق واحد.",
      subtitle:
        "متاجر حقيقية، مخزون حقيقي، أسعار حقيقية — تصفّح الأقسام، قارن بين البائعين، وأكمل طلبك بثقة.",
      ctaPrimaryLabel: "تصفّح الأقسام",
      ctaPrimaryHref: "/search",
      ctaSecondaryLabel: "ابدأ البيع في فاليو ماركة",
      ctaSecondaryHref: "/sell",
    },
  },
  {
    key: "homepage.featured_categories",
    type: "category_grid",
    locale: "en",
    sortOrder: 1,
    content: { limit: 8 },
  },
  {
    key: "homepage.featured_categories",
    type: "category_grid",
    locale: "ar",
    sortOrder: 1,
    content: { limit: 8 },
  },
  {
    key: "homepage.featured_products",
    type: "product_grid",
    locale: "en",
    sortOrder: 2,
    content: { limit: 8 },
  },
  {
    key: "homepage.featured_products",
    type: "product_grid",
    locale: "ar",
    sortOrder: 2,
    content: { limit: 8 },
  },
];

async function main() {
  console.log("Seeding permissions...");
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  console.log("Seeding roles...");
  for (const role of ROLES) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: record.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: record.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Seeding languages...");
  for (const language of LANGUAGES) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: language,
      create: language,
    });
  }

  console.log("Seeding currencies...");
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  console.log("Seeding countries...");
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: country,
      create: country,
    });
  }

  console.log("Seeding homepage CMS blocks...");
  for (const block of CMS_BLOCKS) {
    const existing = await prisma.cmsBlock.findFirst({
      where: { key: block.key, locale: block.locale, pageId: null },
    });
    if (existing) {
      await prisma.cmsBlock.update({
        where: { id: existing.id },
        data: { type: block.type, sortOrder: block.sortOrder, content: block.content },
      });
    } else {
      await prisma.cmsBlock.create({
        data: {
          key: block.key,
          type: block.type,
          locale: block.locale,
          sortOrder: block.sortOrder,
          content: block.content,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
