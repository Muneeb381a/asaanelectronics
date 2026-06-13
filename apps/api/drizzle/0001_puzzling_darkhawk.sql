CREATE TABLE "cash_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"imei_number" text,
	"note" text,
	"sold_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_sales" ADD CONSTRAINT "cash_sales_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sales" ADD CONSTRAINT "cash_sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sales" ADD CONSTRAINT "cash_sales_sold_by_user_id_users_id_fk" FOREIGN KEY ("sold_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cash_sales_seller" ON "cash_sales" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_cash_sales_created_at" ON "cash_sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cash_sales_product" ON "cash_sales" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_cash_sales_seller_date" ON "cash_sales" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cash_sales_sold_by" ON "cash_sales" USING btree ("sold_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_cash_sales_sold_by_date" ON "cash_sales" USING btree ("sold_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_installments_customer_status_del" ON "installments" USING btree ("customer_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_seller_date" ON "ledger_entries" USING btree ("seller_id","date");--> statement-breakpoint
CREATE INDEX "idx_payments_collected_by" ON "payments" USING btree ("collected_by");--> statement-breakpoint
CREATE INDEX "idx_payments_collected_by_date" ON "payments" USING btree ("collected_by","paid_on");--> statement-breakpoint
CREATE INDEX "idx_products_seller_deleted" ON "products" USING btree ("seller_id","deleted_at");