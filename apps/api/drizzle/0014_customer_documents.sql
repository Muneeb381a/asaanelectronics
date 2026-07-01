-- CM3: Customer Document Checklist — track physical docs per customer
CREATE TABLE IF NOT EXISTS "customer_documents" (
  "id"          text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "seller_id"   text NOT NULL REFERENCES "sellers"("id")  ON DELETE CASCADE,
  "doc_type"    text NOT NULL,
  "label"       text NOT NULL,
  "status"      text NOT NULL DEFAULT 'RECEIVED',
  "notes"       text,
  "added_by"    text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_customer_docs_customer" ON "customer_documents" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_customer_docs_seller"   ON "customer_documents" ("seller_id");
