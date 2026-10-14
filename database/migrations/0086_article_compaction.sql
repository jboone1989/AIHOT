-- Cheap metadata-only column: actual body compaction runs in bounded background batches.
ALTER TABLE articles ADD COLUMN compacted_at timestamptz;
