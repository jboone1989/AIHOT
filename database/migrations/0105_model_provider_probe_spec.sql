-- Each provider owns a complete documented test request; no test timeout parameter.
ALTER TABLE model_providers ADD COLUMN IF NOT EXISTS probe_spec jsonb;
