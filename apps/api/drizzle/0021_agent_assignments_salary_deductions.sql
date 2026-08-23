-- Create salary_deduction_type enum
DO $$ BEGIN
  CREATE TYPE "public"."salary_deduction_type" AS ENUM('UNCOLLECTED', 'ADVANCE', 'DAMAGE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customer assignments — tracks which field agent is responsible for collecting from which customer
CREATE TABLE IF NOT EXISTS "customer_assignments" (
  "id"             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seller_id"      text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "customer_id"    text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "agent_id"       text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "assigned_at"    timestamptz NOT NULL DEFAULT now(),
  "unassigned_at"  timestamptz,
  "assigned_by_id" text NOT NULL REFERENCES "users"("id"),
  "notes"          text,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ca_seller_idx"   ON "customer_assignments" ("seller_id");
CREATE INDEX IF NOT EXISTS "ca_agent_idx"    ON "customer_assignments" ("agent_id");
CREATE INDEX IF NOT EXISTS "ca_customer_idx" ON "customer_assignments" ("customer_id");
CREATE INDEX IF NOT EXISTS "ca_active_idx"   ON "customer_assignments" ("agent_id", "unassigned_at")
  WHERE "unassigned_at" IS NULL;

-- Salary deductions — line items for monthly salary calculation per staff member
CREATE TABLE IF NOT EXISTS "salary_deductions" (
  "id"              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seller_id"       text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "staff_id"        text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "month"           text NOT NULL,
  "type"            "salary_deduction_type" NOT NULL,
  "amount"          numeric(12,2) NOT NULL,
  "description"     text,
  "installment_id"  text REFERENCES "installments"("id") ON DELETE SET NULL,
  "customer_id"     text REFERENCES "customers"("id") ON DELETE SET NULL,
  "created_by_id"   text NOT NULL REFERENCES "users"("id"),
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sd_seller_month_idx" ON "salary_deductions" ("seller_id", "month");
CREATE INDEX IF NOT EXISTS "sd_staff_month_idx"  ON "salary_deductions" ("staff_id", "month");
