-- Per-provider, per-capability bulk check results; durable across restarts.
CREATE TABLE model_provider_bulk_checks (
 run_id uuid NOT NULL,
 vendor text NOT NULL,
 model_id text NOT NULL,
 capability text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','verified','failed','unknown','unsupported')),
 latency_ms integer,
 detail text,
 requested_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (run_id,vendor,model_id,capability)
);
