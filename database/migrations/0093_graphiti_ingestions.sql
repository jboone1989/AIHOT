-- One receipt for each processed article revision; graph entities and facts live in Graphiti.
CREATE TABLE IF NOT EXISTS graphiti_ingestions (
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  episode_id text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, revision)
);
