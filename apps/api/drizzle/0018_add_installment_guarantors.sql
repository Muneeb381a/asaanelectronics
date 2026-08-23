CREATE TYPE "public"."biometric_status" AS ENUM('PENDING', 'SELLER_DONE', 'BUYER_DONE', 'COMPLETED', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."handover_status" AS ENUM('PENDING', 'CONFIRMED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."letter_status" AS ENUM('NONE', 'FIRST_NOTICE', 'SECOND_NOTICE', 'LEGAL_NOTICE', 'FILED');--> statement-breakpoint
CREATE TYPE "public"."pta_status" AS ENUM('approved', 'non_pta', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."vehicle_file_location" AS ENUM('WITH_SHOP', 'WITH_CUSTOMER', 'WITH_RTO', 'WITH_NADRA', 'IN_TRANSFER', 'WITH_COURT', 'WITH_POLICE');--> statement-breakpoint
CREATE TABLE "admin_broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"target_plan" text DEFAULT 'ALL' NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_payment_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text DEFAULT 'BANK' NOT NULL,
	"reference" text,
	"for_month" text,
	"note" text,
	"logged_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_shop_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"date" date NOT NULL,
	"clock_in" timestamp with time zone DEFAULT now() NOT NULL,
	"clock_out" timestamp with time zone,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"category_name" text NOT NULL,
	"fields" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"month" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_by_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"notes" text,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"locked_by_user_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "repossessions" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"installment_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"repossessed_date" date NOT NULL,
	"device_name" text NOT NULL,
	"imei" text,
	"condition" text DEFAULT 'fair' NOT NULL,
	"reason" text,
	"amount_recovered" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_at_repossession" numeric(12, 2),
	"assessed_value" numeric(12, 2),
	"status" text DEFAULT 'in_stock' NOT NULL,
	"sold_price" numeric(12, 2),
	"sold_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"month" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_by_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_handovers" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"handed_amount" numeric(14, 2) NOT NULL,
	"confirmed_amount" numeric(14, 2),
	"note" text,
	"owner_note" text,
	"status" "handover_status" DEFAULT 'PENDING' NOT NULL,
	"handover_date" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"confirmed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"seller_id" text,
	"shop_name" text,
	"note" text,
	"meta" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"product_id" text,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text NOT NULL,
	"invoice_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"iban" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"customer_id" text,
	"installment_id" text,
	"cash_sale_id" text,
	"device_name" text NOT NULL,
	"brand" text,
	"model" text,
	"imei" text,
	"color" text,
	"storage_gb" integer,
	"condition" text DEFAULT 'fair' NOT NULL,
	"assessed_value" numeric(12, 2) NOT NULL,
	"notes" text,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"sold_price" numeric(12, 2),
	"sold_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_units" ALTER COLUMN "imei" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referred_by_id" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_blacklisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "blacklist_reason" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "blacklisted_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "blacklisted_by" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "file_number" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "paused_until" timestamp;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "paused_by" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "letter_status" "letter_status";--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "letter_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "biometric_status" "biometric_status";--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "biometric_done_at" timestamp;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor_name" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor_phone" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor_cnic" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor_relation" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor_address" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor2_name" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor2_phone" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor2_cnic" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor2_relation" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "guarantor2_address" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_number" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "deleted_reason" text;--> statement-breakpoint
ALTER TABLE "product_units" ADD COLUMN "serial_type" text DEFAULT 'imei' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_units" ADD COLUMN "serial_number" text;--> statement-breakpoint
ALTER TABLE "product_units" ADD COLUMN "pta_status" "pta_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "min_stock" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "engine_number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "chassis_number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vehicle_condition" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model_year" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "letter_status" "letter_status";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "biometric_status" "biometric_status";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vehicle_file_location" "vehicle_file_location";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "attributes" json;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "settings" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "commission_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_salary" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "admin_broadcasts" ADD CONSTRAINT "admin_broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_payment_logs" ADD CONSTRAINT "admin_payment_logs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_payment_logs" ADD CONSTRAINT "admin_payment_logs_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_shop_notes" ADD CONSTRAINT "admin_shop_notes_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_shop_notes" ADD CONSTRAINT "admin_shop_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_templates" ADD CONSTRAINT "category_templates_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repossessions" ADD CONSTRAINT "repossessions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repossessions" ADD CONSTRAINT "repossessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_handovers" ADD CONSTRAINT "staff_handovers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_handovers" ADD CONSTRAINT "staff_handovers_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_handovers" ADD CONSTRAINT "staff_handovers_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_broadcasts_active" ON "admin_broadcasts" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_payment_logs_seller" ON "admin_payment_logs" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_admin_payment_logs_created" ON "admin_payment_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_shop_notes_seller" ON "admin_shop_notes" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_seller_date" ON "attendance" USING btree ("seller_id","date");--> statement-breakpoint
CREATE INDEX "idx_attendance_user" ON "attendance" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_category_templates_seller_cat" ON "category_templates" USING btree ("seller_id","category_name");--> statement-breakpoint
CREATE INDEX "idx_category_templates_seller" ON "category_templates" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_commission_staff_month" ON "commission_payments" USING btree ("seller_id","staff_id","month");--> statement-breakpoint
CREATE INDEX "idx_commission_payments_seller" ON "commission_payments" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_customer_docs_customer" ON "customer_documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_docs_seller" ON "customer_documents" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_financial_periods_seller_ym" ON "financial_periods" USING btree ("seller_id","year","month");--> statement-breakpoint
CREATE INDEX "idx_financial_periods_seller" ON "financial_periods" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_repossessions_seller" ON "repossessions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_repossessions_customer" ON "repossessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_repossessions_seller_status" ON "repossessions" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "idx_repossessions_installment" ON "repossessions" USING btree ("installment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_salary_staff_month" ON "salary_payments" USING btree ("seller_id","staff_id","month");--> statement-breakpoint
CREATE INDEX "idx_salary_payments_seller" ON "salary_payments" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_handovers_seller" ON "staff_handovers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_handovers_staff" ON "staff_handovers" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_handovers_date" ON "staff_handovers" USING btree ("handover_date");--> statement-breakpoint
CREATE INDEX "idx_handovers_status" ON "staff_handovers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_super_admin_audit_actor" ON "super_admin_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_super_admin_audit_seller" ON "super_admin_audit_logs" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_super_admin_audit_created" ON "super_admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sup_inv_lines_invoice" ON "supplier_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_sup_inv_lines_seller" ON "supplier_invoice_lines" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_sup_inv_supplier" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_sup_inv_seller" ON "supplier_invoices" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_sup_inv_date" ON "supplier_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_suppliers_seller" ON "suppliers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_trade_ins_seller" ON "trade_ins" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_trade_ins_customer" ON "trade_ins" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_trade_ins_seller_status" ON "trade_ins" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "idx_wa_templates_seller" ON "whatsapp_templates" USING btree ("seller_id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_customers_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_blacklisted_by_users_id_fk" FOREIGN KEY ("blacklisted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_paused_by_users_id_fk" FOREIGN KEY ("paused_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_seller_action" ON "audit_logs" USING btree ("seller_id","action","created_at");--> statement-breakpoint
CREATE INDEX "idx_expenses_recurring" ON "expenses" USING btree ("seller_id","is_recurring");--> statement-breakpoint
CREATE INDEX "idx_product_units_seller_serial" ON "product_units" USING btree ("seller_id","serial_number");--> statement-breakpoint
CREATE INDEX "idx_users_seller" ON "users" USING btree ("seller_id");