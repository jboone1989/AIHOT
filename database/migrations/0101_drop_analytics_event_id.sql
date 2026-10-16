-- Analytics events are only counted and pruned by time (admin/analytics.ts); nothing reads a row by its id.
ALTER TABLE product_analytics_events DROP COLUMN IF EXISTS id;
