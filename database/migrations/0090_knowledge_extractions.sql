-- Records zero-edge results as well as successful extractions to avoid repeated spending.
CREATE TABLE IF NOT EXISTS knowledge_extractions (
  article_id text PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('complete','deferred')),
  receipt_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);
