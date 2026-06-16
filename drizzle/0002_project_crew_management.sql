ALTER TABLE "project" ADD COLUMN "address" text;--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_project_user_unique" ON "project_member" USING btree ("project_id","user_id");