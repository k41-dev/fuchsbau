ALTER TABLE "project" ADD COLUMN "background_image_data" bytea;
ALTER TABLE "project" ADD COLUMN "background_image_content_type" text;
ALTER TABLE "project" DROP COLUMN "background_image_path";