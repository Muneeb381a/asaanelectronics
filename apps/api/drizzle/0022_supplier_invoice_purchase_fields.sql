-- Add invoice number, payment method, and due date to supplier invoices
ALTER TABLE "supplier_invoices"
  ADD COLUMN "invoice_number" text,
  ADD COLUMN "payment_method" text,
  ADD COLUMN "due_date" date;
