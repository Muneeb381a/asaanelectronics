-- Migration 0016: super_admin_audit_logs table for A10 admin accountability

CREATE TABLE IF NOT EXISTS "super_admin_audit_logs" (
  "id"         text PRIMARY KEY,
  "actor_id"   text REFERENCES "users"("id") ON DELETE SET NULL,
  "action"     text NOT NULL,
  "seller_id"  text REFERENCES "sellers"("id") ON DELETE SET NULL,
  "shop_name"  text,
  "note"       text,
  "meta"       json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_super_admin_audit_actor"   ON "super_admin_audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_super_admin_audit_seller"  ON "super_admin_audit_logs" ("seller_id");
CREATE INDEX IF NOT EXISTS "idx_super_admin_audit_created" ON "super_admin_audit_logs" ("created_at");
