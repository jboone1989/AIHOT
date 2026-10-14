-- Build outside the release transaction so regular article writes can continue.
CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_compaction_due_idx ON articles (discovered_at, id)
  WHERE compacted_at IS NULL AND processing_state IN ('analyzed', 'blocked', 'skipped') AND x_post IS NULL;
