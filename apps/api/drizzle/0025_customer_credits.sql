CREATE TYPE "customer_credit_type" AS ENUM ('OVERPAYMENT', 'APPLIED', 'REFUND');
--> statement-breakpoint
CREATE TABLE "customer_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" "customer_credit_type" NOT NULL,
	"source_payment_id" text,
	"applied_to_installment_id" text,
	"note" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_applied_to_installment_id_installments_id_fk" FOREIGN KEY ("applied_to_installment_id") REFERENCES "public"."installments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_customer_credits_customer" ON "customer_credits" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX "idx_customer_credits_seller" ON "customer_credits" USING btree ("seller_id");
