-- Add parsed_data JSONB column to sdlc_files table for faster queries
ALTER TABLE "sdlc_files" ADD COLUMN "parsed_data" jsonb;
