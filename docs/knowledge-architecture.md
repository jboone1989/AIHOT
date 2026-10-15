# LivingRuntime knowledge layer: reuse upstream engines

**Intent:** A news site that compounds into a sourced, evolving knowledge base,
usable by the AIHot UI and later by Ferro or other agents.

## Clear ownership

- **AIHot PostgreSQL remains canonical for news evidence:** article ID, version,
  original URL, source, timestamp, body, factual event grouping, corrections.
- **Graphiti + Neo4j owns the entity knowledge graph:** entity resolution,
  cross-episode relationship consolidation, temporal validity, graph/hybrid retrieval.
  Each article revision is sent as an episode containing its original URL.
- **LlamaIndex is the future query-side composition layer** for document-tree
  traversal + Graphiti graph retrieval + original article retrieval. Do not
  reimplement LlamaIndex's chunking, index and retrieval internals.
- **AIHot integration is intentionally thin:** send an article, store the Graphiti
  episode ID and revision, provide a search proxy. Avoid maintaining a second
  self-written relationship engine.

## Deployment

The standalone `docker-compose.knowledge.yml` is opt-in via the
`knowledge` profile and is not part of the regular AIHot compose run.
`knowledge_service/server.py` is a small Graphiti-core wrapper, **not an
alternative graph implementation**. No Neo4j or Graphiti API port is published
publicly.

NVIDIA Developer's key has been verified for
`nvidia/nemotron-3-embed-1b` via the embedding API (2048 dimensions). The
Graphiti adapter attaches NVIDIA's required `input_type` to embedding calls.
The text LLM is `openai/gpt-oss-20b` through `OpenAIGenericClient`. Initial end-to-end test: Graphiti 0.30.2 and Neo4j started, a real Google
Gemini article produced retrievable relationships with temporal metadata,
and search returned the original Google URL from its episode. The initial
ingest request exceeded the 115-second client timeout; therefore **bulk
automatic ingestion remains disabled** until completion receipts, cost and
throughput are measured.

To manually import one news item after Graphiti reaches healthy status:

```sh
docker compose -f docker-compose.yml -f docker-compose.knowledge.yml \
  --profile knowledge up -d --build knowledge
docker compose exec -T api node scripts/graphiti-sync.ts
```

`knowledge_sync` holds only the AIHot document revision and Graphiti episode
identifier. The older `knowledge_entities/knowledge_claims` prototype is
**read-only legacy data** while migration is verified. Disable
`KNOWLEDGE_GRAPH_ENABLED` (old extraction scheduler); do not wipe the old
tables or misrepresent their data as Graphiti records.

## Acceptance

1. Real NVIDIA model, embedding and Graphiti/Neo4j connection all succeed.
2. Two related real articles yield relevant shared entities/relations and
   independently traceable original URLs, not connections by co-occurrence.
3. Re-importing a document revision does not produce duplicate active claims.
4. Search from the website and from an agent can retrieve the same evidence.
5. Measured memory stays within development VM capacity; no production impact.

Only then replace the existing graph read API/UI and retire old migrations.
