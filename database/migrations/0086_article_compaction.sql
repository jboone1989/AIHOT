-- Ordinary news retains its stable article identity and source attribution after full content ages out.
-- Compaction removes heavyweight material only; publications, grouping, hashes, and research links survive.
ALTER TABLE articles ADD COLUMN compacted_at timestamptz;
CREATE INDEX articles_compaction_due_idx ON articles (discovered_at, id)
  WHERE compacted_at IS NULL AND processing_state IN ('analyzed', 'blocked', 'skipped') AND x_post IS NULL;
