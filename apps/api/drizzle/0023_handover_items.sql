CREATE TABLE "handover_items" (
	"id" text PRIMARY KEY NOT NULL,
	"handover_id" text NOT NULL,
	"payment_id" text,
	"cash_sale_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handover_id_staff_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."staff_handovers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_cash_sale_id_cash_sales_id_fk" FOREIGN KEY ("cash_sale_id") REFERENCES "public"."cash_sales"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_handover_items_handover" ON "handover_items" USING btree ("handover_id");
--> statement-breakpoint
CREATE INDEX "idx_handover_items_payment" ON "handover_items" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX "idx_handover_items_cash_sale" ON "handover_items" USING btree ("cash_sale_id");
