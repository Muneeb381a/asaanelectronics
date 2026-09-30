ALTER TABLE "attendance" ADD COLUMN "clock_in_lat" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "clock_in_lng" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "clock_out_lat" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "clock_out_lng" numeric(10, 7);
