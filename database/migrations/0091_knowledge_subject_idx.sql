CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_claims_subject_idx ON knowledge_claims (subject_key, predicate, object_key);
