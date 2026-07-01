-- FA3: Monthly Financial Close — lock/unlock accounting periods
CREATE TABLE IF NOT EXISTS "financial_periods" (
  "id"               text PRIMARY KEY NOT NULL,
  "seller_id"        text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "year"             integer NOT NULL,
  "month"            integer NOT NULL,
  "locked_at"        timestamp DEFAULT now() NOT NULL,
  "locked_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "notes"            text
);

CREATE UNIQUE INDEX IF NOT EXISTS "uidx_financial_periods_seller_ym"
  ON "financial_periods" ("seller_id", "year", "month");

CREATE INDEX IF NOT EXISTS "idx_financial_periods_seller"
  ON "financial_periods" ("seller_id");
