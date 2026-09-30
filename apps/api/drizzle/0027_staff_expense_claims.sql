CREATE TYPE "expense_claim_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
--> statement-breakpoint
CREATE TABLE "staff_expense_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"claim_date" timestamp NOT NULL,
	"receipt_image_url" text,
	"status" "expense_claim_status" DEFAULT 'PENDING' NOT NULL,
	"approved_amount" numeric(12, 2),
	"owner_note" text,
	"expense_id" text,
	"approved_by_id" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_expense_claims" ADD CONSTRAINT "staff_expense_claims_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_expense_claims" ADD CONSTRAINT "staff_expense_claims_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_expense_claims" ADD CONSTRAINT "staff_expense_claims_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_expense_claims" ADD CONSTRAINT "staff_expense_claims_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_expense_claims_seller" ON "staff_expense_claims" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "idx_expense_claims_staff" ON "staff_expense_claims" USING btree ("staff_id");
--> statement-breakpoint
CREATE INDEX "idx_expense_claims_status" ON "staff_expense_claims" USING btree ("status");
