-- Online, nonblocking index build on the new analytics table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_analytics_time_idx ON product_analytics_events (occurred_at DESC);
