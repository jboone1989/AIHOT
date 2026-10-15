-- Each edge is a claim from one specific article revision, NOT an eternal fact.
-- A new article revision supersedes its older claims at read time.
CREATE TABLE IF NOT EXISTS knowledge_claims (
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  subject_key text NOT NULL REFERENCES knowledge_entities(entity_key),
  predicate text NOT NULL,
  object_key text NOT NULL REFERENCES knowledge_entities(entity_key),
  evidence text NOT NULL,
  receipt_id bigint,
  occurred_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id,revision,subject_key,predicate,object_key)
);
