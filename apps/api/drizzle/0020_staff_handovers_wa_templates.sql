-- Create handover_status enum
DO $$ BEGIN
  CREATE TYPE "public"."handover_status" AS ENUM('PENDING', 'CONFIRMED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create staff_handovers table
CREATE TABLE IF NOT EXISTS "staff_handovers" (
  "id"               text PRIMARY KEY,
  "seller_id"        text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "staff_id"         text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "handed_amount"    numeric(14,2) NOT NULL,
  "confirmed_amount" numeric(14,2),
  "note"             text,
  "owner_note"       text,
  "status"           "handover_status" NOT NULL DEFAULT 'PENDING',
  "handover_date"    timestamp NOT NULL,
  "confirmed_at"     timestamp,
  "confirmed_by_id"  text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_handovers_seller" ON "staff_handovers"("seller_id");
CREATE INDEX IF NOT EXISTS "idx_handovers_staff"  ON "staff_handovers"("staff_id");
CREATE INDEX IF NOT EXISTS "idx_handovers_date"   ON "staff_handovers"("handover_date");
CREATE INDEX IF NOT EXISTS "idx_handovers_status" ON "staff_handovers"("status");

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id"         text PRIMARY KEY,
  "seller_id"  text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "name"       text NOT NULL,
  "body"       text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_wa_templates_seller" ON "whatsapp_templates"("seller_id");
