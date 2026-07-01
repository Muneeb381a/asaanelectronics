-- PC4: Payment reversal — add reason field to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
