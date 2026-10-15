-- AIHot's only persistent Graphiti cursor. Nodes, edges, entity resolution and history live in Graphiti/Neo4j.
CREATE TABLE IF NOT EXISTS knowledge_sync (
  article_id text PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  episode_id text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
