-- Trade-Ins: devices customers bring in as part-exchange
CREATE TABLE "trade_ins" (
  "id"             text PRIMARY KEY NOT NULL,
  "seller_id"      text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "customer_id"    text REFERENCES "customers"("id") ON DELETE SET NULL,
  "installment_id" text REFERENCES "installments"("id") ON DELETE SET NULL,
  "cash_sale_id"   text REFERENCES "cash_sales"("id") ON DELETE SET NULL,
  "device_name"    text NOT NULL,
  "brand"          text,
  "model"          text,
  "imei"           text,
  "color"          text,
  "storage_gb"     integer,
  "condition"      text NOT NULL DEFAULT 'fair',
  "assessed_value" numeric(12,2) NOT NULL,
  "notes"          text,
  "status"         text NOT NULL DEFAULT 'in_stock',
  "sold_price"     numeric(12,2),
  "sold_at"        timestamp,
  "created_at"     timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "idx_trade_ins_seller"        ON "trade_ins" ("seller_id");
CREATE INDEX "idx_trade_ins_customer"      ON "trade_ins" ("customer_id");
CREATE INDEX "idx_trade_ins_seller_status" ON "trade_ins" ("seller_id", "status");

-- Repossessions: devices seized when customers default
CREATE TABLE "repossessions" (
  "id"                          text PRIMARY KEY NOT NULL,
  "seller_id"                   text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "installment_id"              text NOT NULL REFERENCES "installments"("id"),
  "customer_id"                 text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "repossessed_date"            date NOT NULL DEFAULT CURRENT_DATE,
  "device_name"                 text NOT NULL,
  "imei"                        text,
  "condition"                   text NOT NULL DEFAULT 'fair',
  "reason"                      text,
  "amount_recovered"            numeric(12,2) NOT NULL DEFAULT 0,
  "outstanding_at_repossession" numeric(12,2),
  "assessed_value"              numeric(12,2),
  "status"                      text NOT NULL DEFAULT 'in_stock',
  "sold_price"                  numeric(12,2),
  "sold_at"                     timestamp,
  "notes"                       text,
  "created_at"                  timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "idx_repossessions_seller"       ON "repossessions" ("seller_id");
CREATE INDEX "idx_repossessions_customer"     ON "repossessions" ("customer_id");
CREATE INDEX "idx_repossessions_installment"  ON "repossessions" ("installment_id");
CREATE INDEX "idx_repossessions_seller_status" ON "repossessions" ("seller_id", "status");
