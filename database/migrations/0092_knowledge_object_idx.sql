CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_claims_object_idx ON knowledge_claims (object_key, predicate, subject_key);
