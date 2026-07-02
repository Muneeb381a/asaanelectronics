-- SaaS admin: manual payment logs per shop
CREATE TABLE IF NOT EXISTS "admin_payment_logs" (
  "id"         text PRIMARY KEY NOT NULL,
  "seller_id"  text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "amount"     decimal(12,2) NOT NULL,
  "method"     text NOT NULL DEFAULT 'BANK',
  "reference"  text,
  "for_month"  text,
  "note"       text,
  "logged_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_admin_payment_logs_seller"  ON "admin_payment_logs" ("seller_id");
CREATE INDEX IF NOT EXISTS "idx_admin_payment_logs_created" ON "admin_payment_logs" ("created_at");

-- SaaS admin: internal notes per shop
CREATE TABLE IF NOT EXISTS "admin_shop_notes" (
  "id"         text PRIMARY KEY NOT NULL,
  "seller_id"  text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "content"    text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_admin_shop_notes_seller" ON "admin_shop_notes" ("seller_id");
