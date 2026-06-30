-- Manual customer blacklist (do-not-sell flag with reason)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_blacklisted   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blacklist_reason  TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blacklisted_by    TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_blacklisted ON customers (seller_id, is_blacklisted)
  WHERE is_blacklisted = TRUE;

-- Auto-numbered payment receipts per seller
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments (receipt_number);
