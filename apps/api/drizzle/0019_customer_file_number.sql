-- Add permanent file number to customers (sequential per seller, format: 0001, 0002, …)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "file_number" text;

-- Backfill existing customers with sequential file numbers per seller, ordered by created_at
WITH ranked AS (
  SELECT
    id,
    LPAD(ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY created_at ASC)::text, 4, '0') AS fn
  FROM customers
)
UPDATE customers c
SET file_number = r.fn
FROM ranked r
WHERE c.id = r.id AND c.file_number IS NULL;
