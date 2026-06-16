ALTER TABLE "absence" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "absence" ADD COLUMN "request_group_id" text;--> statement-breakpoint
ALTER TABLE "absence" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "absence" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "absence" ADD COLUMN "review_note" text;--> statement-breakpoint
UPDATE "absence" SET "status" = 'approved', "request_group_id" = 'legacy-' || "id"::text WHERE "request_group_id" IS NULL;--> statement-breakpoint
ALTER TABLE "absence" ALTER COLUMN "request_group_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "absence_user_date_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "absence_user_date_active_unique" ON "absence" ("user_id","date") WHERE status != 'rejected';--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;