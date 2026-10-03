CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "VariantStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_STOCK', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'LOST', 'THEFT', 'EXCHANGE_IN', 'EXCHANGE_OUT');
CREATE TYPE "StockAdjustmentReason" AS ENUM ('OPENING_STOCK', 'CORRECTION', 'DAMAGED', 'LOST', 'THEFT', 'FOUND', 'OTHER');

CREATE TABLE "categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500), "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"), CONSTRAINT "categories_name_key" UNIQUE ("name")
);
CREATE INDEX "categories_is_active_name_idx" ON "categories"("is_active", "name");
CREATE UNIQUE INDEX "categories_name_ci_key" ON "categories"(LOWER("name"));

CREATE TABLE "brands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(100) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brands_pkey" PRIMARY KEY ("id"), CONSTRAINT "brands_name_key" UNIQUE ("name")
);
CREATE INDEX "brands_is_active_name_idx" ON "brands"("is_active", "name");
CREATE UNIQUE INDEX "brands_name_ci_key" ON "brands"(LOWER("name"));

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "product_code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(160) NOT NULL, "description" VARCHAR(1000), "hsn_code" VARCHAR(20),
  "category_id" UUID NOT NULL, "brand_id" UUID, "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"), CONSTRAINT "products_product_code_key" UNIQUE ("product_code")
);
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");
CREATE INDEX "products_brand_id_status_idx" ON "products"("brand_id", "status");

CREATE TABLE "product_variants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "product_id" UUID NOT NULL,
  "sku" VARCHAR(80) NOT NULL, "barcode" VARCHAR(80), "size" VARCHAR(40), "color" VARCHAR(60),
  "design" VARCHAR(100), "fabric" VARCHAR(100), "pattern" VARCHAR(100),
  "purchase_cost" DECIMAL(19,4) NOT NULL, "mrp" DECIMAL(19,4) NOT NULL,
  "retail_price" DECIMAL(19,4) NOT NULL, "wholesale_price" DECIMAL(19,4) NOT NULL,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0, "min_stock_level" INTEGER NOT NULL DEFAULT 0,
  "status" "VariantStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_sku_key" UNIQUE ("sku"), CONSTRAINT "product_variants_barcode_key" UNIQUE ("barcode"),
  CONSTRAINT "product_variants_stock_check" CHECK ("stock_quantity" >= 0),
  CONSTRAINT "product_variants_min_stock_check" CHECK ("min_stock_level" >= 0),
  CONSTRAINT "product_variants_prices_check" CHECK ("purchase_cost" >= 0 AND "mrp" >= 0 AND "retail_price" >= 0 AND "wholesale_price" >= 0)
);
CREATE INDEX "product_variants_product_id_status_idx" ON "product_variants"("product_id", "status");
CREATE INDEX "product_variants_stock_quantity_idx" ON "product_variants"("stock_quantity");

CREATE TABLE "stock_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "variant_id" UUID NOT NULL,
  "quantity_delta" INTEGER NOT NULL, "reason" "StockAdjustmentReason" NOT NULL,
  "notes" VARCHAR(500), "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id"), CONSTRAINT "stock_adjustments_delta_check" CHECK ("quantity_delta" <> 0)
);
CREATE INDEX "stock_adjustments_variant_id_created_at_idx" ON "stock_adjustments"("variant_id", "created_at" DESC);
CREATE INDEX "stock_adjustments_created_by_id_created_at_idx" ON "stock_adjustments"("created_by_id", "created_at" DESC);

CREATE TABLE "stock_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "variant_id" UUID NOT NULL,
  "type" "StockMovementType" NOT NULL, "quantity" INTEGER NOT NULL, "balance_after" INTEGER NOT NULL,
  "reference_type" VARCHAR(50), "reference_id" UUID, "stock_adjustment_id" UUID,
  "notes" VARCHAR(500), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_stock_adjustment_id_key" UNIQUE ("stock_adjustment_id"),
  CONSTRAINT "stock_movements_quantity_check" CHECK ("quantity" <> 0), CONSTRAINT "stock_movements_balance_check" CHECK ("balance_after" >= 0)
);
CREATE INDEX "stock_movements_variant_id_created_at_idx" ON "stock_movements"("variant_id", "created_at" DESC);
CREATE INDEX "stock_movements_type_created_at_idx" ON "stock_movements"("type", "created_at" DESC);
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

CREATE TABLE "price_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "variant_id" UUID NOT NULL,
  "old_purchase_cost" DECIMAL(19,4) NOT NULL, "new_purchase_cost" DECIMAL(19,4) NOT NULL,
  "old_mrp" DECIMAL(19,4) NOT NULL, "new_mrp" DECIMAL(19,4) NOT NULL,
  "old_retail_price" DECIMAL(19,4) NOT NULL, "new_retail_price" DECIMAL(19,4) NOT NULL,
  "old_wholesale_price" DECIMAL(19,4) NOT NULL, "new_wholesale_price" DECIMAL(19,4) NOT NULL,
  "changed_by_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_history_variant_id_created_at_idx" ON "price_history"("variant_id", "created_at" DESC);

ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
