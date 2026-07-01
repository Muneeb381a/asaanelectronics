-- IW7: Installment pause / freeze
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS paused_until  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pause_reason  TEXT,
  ADD COLUMN IF NOT EXISTS paused_by     TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_installments_paused ON installments (paused_until)
  WHERE paused_until IS NOT NULL;
