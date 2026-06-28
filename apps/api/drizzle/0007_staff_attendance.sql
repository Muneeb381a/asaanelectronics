CREATE TABLE "attendance" (
  "id"         text PRIMARY KEY NOT NULL,
  "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "seller_id"  text NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "date"       date NOT NULL,
  "clock_in"   timestamp with time zone NOT NULL DEFAULT now(),
  "clock_out"  timestamp with time zone,
  "notes"      text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "idx_attendance_seller_date" ON "attendance" ("seller_id", "date");
CREATE INDEX "idx_attendance_user" ON "attendance" ("user_id");
