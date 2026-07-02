CREATE TABLE IF NOT EXISTS "admin_broadcasts" (
  "id"          text PRIMARY KEY NOT NULL,
  "title"       text NOT NULL,
  "body"        text NOT NULL,
  "target_plan" text NOT NULL DEFAULT 'ALL',
  "type"        text NOT NULL DEFAULT 'info',
  "is_active"   boolean NOT NULL DEFAULT true,
  "expires_at"  timestamptz,
  "created_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_admin_broadcasts_active"
  ON "admin_broadcasts"("is_active", "created_at");
