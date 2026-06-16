CREATE TABLE "time_entry_correction" (
	"id" serial PRIMARY KEY NOT NULL,
	"time_entry_id" integer NOT NULL,
	"corrected_by_user_id" text NOT NULL,
	"previous_start_time" timestamp NOT NULL,
	"previous_end_time" timestamp,
	"previous_duration" integer,
	"new_start_time" timestamp NOT NULL,
	"new_end_time" timestamp,
	"new_duration" integer,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "time_entry_correction" ADD CONSTRAINT "time_entry_correction_time_entry_id_time_entry_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_correction" ADD CONSTRAINT "time_entry_correction_corrected_by_user_id_user_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;