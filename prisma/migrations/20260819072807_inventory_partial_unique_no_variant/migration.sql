-- Enforces one Inventory row per (productId, warehouseId) when the product
-- has no variant. Postgres does not apply the existing
-- @@unique([productId, variantId, warehouseId]) constraint when variantId
-- is NULL (NULLs are never considered equal), so simple (non-variant)
-- products would otherwise have no database-level protection against
-- duplicate Inventory rows. See src/server/services/inventory.ts.
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_no_variant_key"
  ON "Inventory" ("productId", "warehouseId")
  WHERE "variantId" IS NULL;
