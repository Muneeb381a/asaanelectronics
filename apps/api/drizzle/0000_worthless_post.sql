CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('RENT', 'SALARY', 'UTILITY', 'PURCHASE', 'MAINTENANCE', 'TRANSPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."ledger_ref_type" AS ENUM('PAYMENT', 'EXPENSE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TYPE "public"."payment_account_type" AS ENUM('BANK', 'JAZZCASH', 'EASYPAISA', 'SADAPAY', 'NAYAPAY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."recovery_action_type" AS ENUM('CALLED', 'VISITED', 'PROMISE_TO_PAY', 'REFUSED', 'LEGAL_WARNING');--> statement-breakpoint
CREATE TYPE "public"."resolution_type" AS ENUM('RESALE', 'DAMAGED_WRITE_OFF', 'REPLACEMENT_SENT');--> statement-breakpoint
CREATE TYPE "public"."return_condition" AS ENUM('GOOD', 'DAMAGED', 'UNUSABLE');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('DEFECTIVE', 'DAMAGED_IN_USE', 'WRONG_ITEM', 'CUSTOMER_REQUEST', 'WARRANTY_CLAIM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('RETURN', 'EXCHANGE', 'WARRANTY_REPLACEMENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'SELLER_OWNER', 'SELLER_STAFF');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"user_id" text,
	"session_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"description" text NOT NULL,
	"reason" text,
	"before" json,
	"after" json,
	"meta" json,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"user_id" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"cnic_hash" text NOT NULL,
	"cnic_masked" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"occupation" text,
	"employer" text,
	"area" text,
	"father_name" text,
	"cnic_expiry" text,
	"guarantor_name" text,
	"guarantor_phone" text,
	"guarantor_cnic" text,
	"guarantor_address" text,
	"guarantor_relation" text,
	"guarantor2_name" text,
	"guarantor2_phone" text,
	"guarantor2_cnic" text,
	"guarantor2_address" text,
	"guarantor2_relation" text,
	"office_address" text,
	"salary" numeric(12, 2),
	"blank_cheque_url" text,
	"cheque_bank" text,
	"cheque_account_no" text,
	"cheque_no" text,
	"photo_url" text,
	"cnic_front_url" text,
	"cnic_back_url" text,
	"guarantor_cnic_front_url" text,
	"guarantor_cnic_back_url" text,
	"guarantor2_cnic_front_url" text,
	"guarantor2_cnic_back_url" text,
	"cnic_front_hash" text,
	"cnic_back_hash" text,
	"blank_cheque_hash" text,
	"customer_type" text DEFAULT 'regular' NOT NULL,
	"shop_name" text,
	"shop_address" text,
	"business_type" text,
	"guarantor_shop_name" text,
	"guarantor_shop_address" text,
	"guarantor2_shop_name" text,
	"guarantor2_shop_address" text,
	"created_by_user_id" text,
	"assigned_avo_id" text,
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"down_payment" numeric(12, 2) NOT NULL,
	"remaining" numeric(12, 2) NOT NULL,
	"monthly" numeric(12, 2) NOT NULL,
	"months" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"invoice_number" text,
	"status" "installment_status" DEFAULT 'PENDING' NOT NULL,
	"imei_number" text,
	"cash_price" numeric(12, 2),
	"profit_markup" numeric(12, 2),
	"payment_frequency" text DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"memo" text NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"posted_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"reference_id" text,
	"ref_type" "ledger_ref_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL,
	"account_id" text NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_cache" (
	"hash" text NOT NULL,
	"doc_type" text NOT NULL,
	"result" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"type" "payment_account_type" NOT NULL,
	"account_title" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"installment_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" timestamp DEFAULT now() NOT NULL,
	"method" "payment_method" NOT NULL,
	"note" text,
	"collected_by" text,
	"proof_image_url" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"brand" text,
	"model" text,
	"color" text,
	"price" numeric(12, 2) NOT NULL,
	"installment_price" numeric(12, 2),
	"purchase_price" numeric(12, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"serial" text,
	"warranty_months" integer,
	"description" text,
	"deleted_at" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"trigger" text DEFAULT 'SCHEDULED' NOT NULL,
	"status" text NOT NULL,
	"anomaly_count" integer DEFAULT 0 NOT NULL,
	"anomalies" json NOT NULL,
	"ledger_total" numeric(12, 2),
	"payments_total" numeric(12, 2),
	"diff" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "recovery_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"installment_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"user_id" text,
	"type" "recovery_action_type" NOT NULL,
	"note" text,
	"promise_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"device_name" text,
	"device_type" text,
	"last_active_at" timestamp DEFAULT now(),
	"is_suspicious" boolean DEFAULT false NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"installment_id" text,
	"customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"type" "return_type" NOT NULL,
	"reason" "return_reason" NOT NULL,
	"condition" "return_condition" NOT NULL,
	"status" "return_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"resolution_type" "resolution_type",
	"replacement_product_id" text,
	"refund_amount" numeric(12, 2),
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"plan" "plan" DEFAULT 'TRIAL' NOT NULL,
	"trial_ends_at" timestamp,
	"plan_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"murabaha_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" "role" DEFAULT 'SELLER_STAFF' NOT NULL,
	"seller_id" text,
	"permissions" json,
	"frozen_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"avo_id" text NOT NULL,
	"status" "verification_status" NOT NULL,
	"address_verified" boolean NOT NULL,
	"employer_verified" boolean NOT NULL,
	"guarantor1_reachable" boolean NOT NULL,
	"guarantor2_reachable" boolean NOT NULL,
	"photo_evidence_url" text,
	"notes" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_accuracy" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verifications_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_refresh_tokens_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."refresh_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_avo_id_users_id_fk" FOREIGN KEY ("assigned_avo_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_journal_id_journal_entries_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_actions" ADD CONSTRAINT "recovery_actions_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_actions" ADD CONSTRAINT "recovery_actions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_actions" ADD CONSTRAINT "recovery_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_replacement_product_id_products_id_fk" FOREIGN KEY ("replacement_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_avo_id_users_id_fk" FOREIGN KEY ("avo_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_seller" ON "audit_logs" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_session" ON "audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_coa_seller" ON "chart_of_accounts" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coa_seller_code" ON "chart_of_accounts" USING btree ("seller_id","code");--> statement-breakpoint
CREATE INDEX "idx_customer_notes_customer" ON "customer_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_notes_seller" ON "customer_notes" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_cnic_hash" ON "customers" USING btree ("cnic_hash");--> statement-breakpoint
CREATE INDEX "idx_cnic_seller" ON "customers" USING btree ("seller_id","cnic_hash");--> statement-breakpoint
CREATE INDEX "idx_customers_seller" ON "customers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_customers_seller_deleted" ON "customers" USING btree ("seller_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_cnic_front_hash" ON "customers" USING btree ("seller_id","cnic_front_hash");--> statement-breakpoint
CREATE INDEX "idx_cnic_back_hash" ON "customers" USING btree ("seller_id","cnic_back_hash");--> statement-breakpoint
CREATE INDEX "idx_blank_cheque_hash" ON "customers" USING btree ("seller_id","blank_cheque_hash");--> statement-breakpoint
CREATE INDEX "idx_customers_phone" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_customers_name" ON "customers" USING btree ("seller_id","name");--> statement-breakpoint
CREATE INDEX "idx_expenses_seller" ON "expenses" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_date" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_installments_customer" ON "installments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_installments_status" ON "installments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_installments_customer_deleted" ON "installments" USING btree ("customer_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_installments_start_date" ON "installments" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_installments_seller_status" ON "installments" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_je_seller" ON "journal_entries" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_je_posted_at" ON "journal_entries" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_seller" ON "ledger_entries" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_date" ON "ledger_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ledger_type" ON "ledger_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_ll_journal" ON "ledger_lines" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "idx_ll_account" ON "ledger_lines" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ocr_cache_hash_doctype" ON "ocr_cache" USING btree ("hash","doc_type");--> statement-breakpoint
CREATE INDEX "idx_otps_user_purpose" ON "otps" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "idx_payment_accounts_seller" ON "payment_accounts" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_payments_installment" ON "payments" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_paid_on" ON "payments" USING btree ("paid_on");--> statement-breakpoint
CREATE INDEX "idx_payments_installment_deleted" ON "payments" USING btree ("installment_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_products_seller" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_products_name" ON "products" USING btree ("seller_id","name");--> statement-breakpoint
CREATE INDEX "idx_recon_seller" ON "reconciliation_runs" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_recon_run_at" ON "reconciliation_runs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "idx_recovery_installment" ON "recovery_actions" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "idx_recovery_seller" ON "recovery_actions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_returns_seller" ON "returns" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_returns_customer" ON "returns" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_returns_status" ON "returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_verifications_avo" ON "verifications" USING btree ("avo_id");