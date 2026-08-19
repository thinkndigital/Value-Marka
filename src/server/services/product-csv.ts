import "server-only";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { prisma } from "@/server/db";
import { productSchema } from "@/server/validation/product";
import * as productService from "@/server/services/products";
import { ProductError } from "@/server/services/products";

const CSV_COLUMNS = [
  "sku",
  "name",
  "slug",
  "categorySlug",
  "brandSlug",
  "price",
  "costPrice",
  "currencyCode",
  "weightGrams",
  "shortDescription",
  "status",
  "stock",
] as const;

export async function exportProductsCsv(sellerId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { slug: true } },
      brand: { select: { slug: true } },
      inventory: { select: { quantity: true, reserved: true } },
    },
  });

  const rows = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    categorySlug: p.category.slug,
    brandSlug: p.brand?.slug ?? "",
    price: p.price.toString(),
    costPrice: p.costPrice.toString(),
    currencyCode: p.currencyCode,
    weightGrams: p.weightGrams ?? "",
    shortDescription: p.shortDescription ?? "",
    status: p.status,
    stock: p.inventory.reduce((sum, i) => sum + (i.quantity - i.reserved), 0),
  }));

  return stringify(rows, { header: true, columns: CSV_COLUMNS });
}

export interface CsvImportError {
  row: number;
  message: string;
}

export interface CsvImportResult {
  created: number;
  updated: number;
  errors: CsvImportError[];
}

interface CsvRow {
  sku?: string;
  name?: string;
  slug?: string;
  categorySlug?: string;
  brandSlug?: string;
  price?: string;
  costPrice?: string;
  currencyCode?: string;
  weightGrams?: string;
  shortDescription?: string;
  stock?: string;
}

/**
 * Every row is processed independently (its own try/catch) so one bad row
 * doesn't discard an otherwise-valid batch — the caller sees exactly which
 * rows failed and why (spec §56 "Show import errors clearly").
 */
export async function importProductsCsv(
  sellerId: string,
  csvText: string,
  warehouseId: string,
  actorId: string,
): Promise<CsvImportResult> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse || warehouse.sellerId !== sellerId) {
    throw new ProductError("Select one of your own warehouses.");
  }

  let records: CsvRow[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new ProductError("Couldn't read that file as CSV.");
  }

  if (records.length === 0) {
    throw new ProductError("The file has no rows to import.");
  }
  if (records.length > 500) {
    throw new ProductError("Import up to 500 rows at a time.");
  }

  const result: CsvImportResult = { created: 0, updated: 0, errors: [] };

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2; // header is row 1
    try {
      const category = record.categorySlug
        ? await prisma.category.findUnique({ where: { slug: record.categorySlug } })
        : null;
      if (!category) {
        throw new ProductError(`Unknown category slug "${record.categorySlug ?? ""}".`);
      }

      const brand = record.brandSlug
        ? await prisma.brand.findUnique({ where: { slug: record.brandSlug } })
        : null;
      if (record.brandSlug && !brand) {
        throw new ProductError(`Unknown brand slug "${record.brandSlug}".`);
      }

      const parsed = productSchema.safeParse({
        name: record.name,
        slug: record.slug || slugify(record.name ?? ""),
        sku: record.sku,
        categoryId: category.id,
        brandId: brand?.id,
        shortDescription: record.shortDescription,
        price: record.price,
        costPrice: record.costPrice,
        currencyCode: record.currencyCode,
        weightGrams: record.weightGrams || undefined,
      });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new ProductError(`${first.path.join(".")}: ${first.message}`);
      }

      const existing = await prisma.product.findUnique({
        where: { sellerId_sku: { sellerId, sku: parsed.data.sku } },
      });

      if (existing) {
        await productService.updateProduct(sellerId, existing.id, parsed.data, []);
        result.updated += 1;
      } else {
        const stock = record.stock ? Math.max(0, Math.trunc(Number(record.stock))) : 0;
        await productService.createProduct(sellerId, parsed.data, {
          warehouseId,
          initialQuantity: Number.isFinite(stock) ? stock : 0,
          images: [],
          actorId,
        });
        result.created += 1;
      }
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return result;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
