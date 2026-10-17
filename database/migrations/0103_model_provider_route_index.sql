-- Concurrent index: ordinary traffic remains live.
CREATE INDEX CONCURRENTLY IF NOT EXISTS model_provider_route_idx ON model_providers (vendor,adapter,complexity) WHERE enabled AND route_enabled;
