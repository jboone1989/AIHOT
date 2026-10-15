-- Anonymous event telemetry. No IP, user-agent, email, query string or persistent visitor ID.
-- Retain at most 90 days; the ingestion path prunes old events opportunistically.
CREATE TABLE IF NOT EXISTS product_analytics_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id UUID NOT NULL,
  event_name VARCHAR(40) NOT NULL,
  page_type VARCHAR(32) NOT NULL,
  language VARCHAR(2) NOT NULL,
  content_id VARCHAR(80),
  duration_ms INTEGER,
  referrer_host VARCHAR(100)
);
