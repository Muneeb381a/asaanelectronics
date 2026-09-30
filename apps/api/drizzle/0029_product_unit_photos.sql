CREATE TABLE "product_unit_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"uploaded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_unit_photos" ADD CONSTRAINT "product_unit_photos_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_unit_photos" ADD CONSTRAINT "product_unit_photos_unit_id_product_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."product_units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_unit_photos" ADD CONSTRAINT "product_unit_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_unit_photos_unit" ON "product_unit_photos" USING btree ("unit_id");
--> statement-breakpoint
CREATE INDEX "idx_unit_photos_seller" ON "product_unit_photos" USING btree ("seller_id");
