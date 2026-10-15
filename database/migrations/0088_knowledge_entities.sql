-- Stable entity identities; do not infer aliases from co-mentions.
CREATE TABLE IF NOT EXISTS knowledge_entities (
  entity_key text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
