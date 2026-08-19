-- Backs product search (src/server/services/search.ts) with a real
-- Postgres trigram index so ILIKE/"contains" substring queries against
-- Product.name are index-accelerated instead of sequential-scanning the
-- whole catalog (spec: "Postgres full-text + trigram to start; swappable").
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);
