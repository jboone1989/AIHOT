-- The worker only asks whether an article revision is in Graphiti (knowledge/graphiti.ts), never when.
ALTER TABLE graphiti_ingestions DROP COLUMN IF EXISTS ingested_at;
