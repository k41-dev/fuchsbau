ALTER TABLE "user" ADD COLUMN "account_role" text DEFAULT 'worker' NOT NULL;--> statement-breakpoint
UPDATE "user" u
SET "account_role" = 'supervisor'
WHERE EXISTS (SELECT 1 FROM "project" p WHERE p.user_id = u.id);--> statement-breakpoint
UPDATE "user"
SET "account_role" = 'supervisor'
WHERE id = (SELECT id FROM "user" ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE account_role = 'supervisor');