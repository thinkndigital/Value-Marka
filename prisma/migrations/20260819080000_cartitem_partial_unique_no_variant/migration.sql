-- Same gap as Inventory (see 20260819072807_inventory_partial_unique_no_variant):
-- Postgres never treats two NULLs as equal, so the existing
-- @@unique([cartId, productId, variantId]) constraint does not stop
-- duplicate CartItem rows for products with no variant (variantId IS NULL,
-- the common case). This partial unique index closes that gap at the
-- database level; src/server/services/cart.ts already works around it in
-- application code via findFirst.
CREATE UNIQUE INDEX "CartItem_cartId_productId_no_variant_key"
  ON "CartItem" ("cartId", "productId")
  WHERE "variantId" IS NULL;
