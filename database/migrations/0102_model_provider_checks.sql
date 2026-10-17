-- Independent capability verification; no global health bitmap.
CREATE TABLE model_provider_checks (
 vendor text NOT NULL,
 model_id text NOT NULL,
 capability text NOT NULL,
 verified_at timestamptz,
 status text NOT NULL CHECK (status IN ('unverified','verified','failed','unknown','unsupported')),
 latency_ms integer,
 detail text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(vendor,model_id,capability),
 FOREIGN KEY(vendor,model_id) REFERENCES model_providers(vendor,model_id) ON DELETE CASCADE
);
