-- Feature: per-staff commission rate, monthly salary, commission payment log, salary payment log

-- Add per-staff overrides to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "commission_rate" numeric(5,2),
  ADD COLUMN IF NOT EXISTS "monthly_salary"  numeric(12,2);

-- Commission payment records (one payout per staff per month)
CREATE TABLE IF NOT EXISTS "commission_payments" (
  "id"          text PRIMARY KEY,
  "seller_id"   text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "staff_id"    text NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "month"       text NOT NULL,
  "amount"      numeric(12,2) NOT NULL,
  "paid_at"     timestamptz   NOT NULL DEFAULT NOW(),
  "paid_by_id"  text          REFERENCES "users"("id")   ON DELETE SET NULL,
  "note"        text,
  "created_at"  timestamp     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_commission_staff_month"
  ON "commission_payments" ("seller_id", "staff_id", "month");

CREATE INDEX IF NOT EXISTS "idx_commission_payments_seller"
  ON "commission_payments" ("seller_id");

-- Salary payment records (one payout per staff per month)
CREATE TABLE IF NOT EXISTS "salary_payments" (
  "id"          text PRIMARY KEY,
  "seller_id"   text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "staff_id"    text NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "month"       text NOT NULL,
  "amount"      numeric(12,2) NOT NULL,
  "paid_at"     timestamptz   NOT NULL DEFAULT NOW(),
  "paid_by_id"  text          REFERENCES "users"("id")   ON DELETE SET NULL,
  "note"        text,
  "created_at"  timestamp     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_salary_staff_month"
  ON "salary_payments" ("seller_id", "staff_id", "month");

CREATE INDEX IF NOT EXISTS "idx_salary_payments_seller"
  ON "salary_payments" ("seller_id");
