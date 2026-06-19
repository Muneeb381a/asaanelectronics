CREATE TYPE "public"."unit_status" AS ENUM('available', 'sold', 'defective', 'returned');--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"product_id" text,
	"imei" text NOT NULL,
	"imei2" text,
	"color" text,
	"storage_gb" integer,
	"condition" text DEFAULT 'new' NOT NULL,
	"purchase_price" numeric(12, 2),
	"status" "unit_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"sold_at" timestamp with time zone,
	"sale_type" text,
	"sold_to_name" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_units_seller_imei" ON "product_units" USING btree ("seller_id","imei");--> statement-breakpoint
CREATE INDEX "idx_product_units_seller" ON "product_units" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_product_units_status" ON "product_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_product_units_product" ON "product_units" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_customers_seller_del_created" ON "customers" USING btree ("seller_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_customers_created_by" ON "customers" USING btree ("created_by_user_id","seller_id");