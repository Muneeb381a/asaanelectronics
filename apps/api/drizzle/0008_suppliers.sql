CREATE TABLE "suppliers" (
  "id"         text PRIMARY KEY NOT NULL,
  "seller_id"  text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "name"       text NOT NULL,
  "phone"      text,
  "address"    text,
  "iban"       text,
  "notes"      text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "idx_suppliers_seller" ON "suppliers" ("seller_id");

CREATE TABLE "supplier_invoices" (
  "id"           text PRIMARY KEY NOT NULL,
  "supplier_id"  text NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "seller_id"    text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "total_amount" decimal(12,2) NOT NULL,
  "paid_amount"  decimal(12,2) DEFAULT '0' NOT NULL,
  "description"  text NOT NULL,
  "invoice_date" date NOT NULL,
  "created_at"   timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "idx_sup_inv_supplier" ON "supplier_invoices" ("supplier_id");
CREATE INDEX "idx_sup_inv_seller"   ON "supplier_invoices" ("seller_id");
CREATE INDEX "idx_sup_inv_date"     ON "supplier_invoices" ("invoice_date");

ALTER TABLE "products" ADD COLUMN "supplier_id" text REFERENCES "suppliers"("id") ON DELETE SET NULL;
CREATE INDEX "idx_products_supplier" ON "products" ("supplier_id");
