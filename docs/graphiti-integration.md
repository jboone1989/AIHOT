# AIHot → Graphiti / Neo4j integration

## Architecture

AIHot owns collection, article revisions, deduplication, story membership, source
provenance, the event tree and full text in PostgreSQL. Graphiti 0.30.2 owns
temporal entity/fact extraction, historical evidence and relationship queries in
Neo4j. No LlamaIndex is installed; add it only when Ferro needs combined retrieval
across the event tree, full text and graph.

- Worker cron (`knowledge.graphiti.ingest`, every five minutes) finds a new
  analyzed editorial article revision and sends one original news item to
  `POST http://knowledge:8000/episodes`. It records the returned episode UUID in
  `graphiti_ingestions`; failures leave that revision available for retries.
- Graphiti derives relations; AIHot does not maintain a second entity/fact engine.
- AIHot story routes resolve story membership in PostgreSQL, then request
  `POST /relations/by-articles` from Graphiti. Graphiti supplies relation edges,
  entities and supporting source episodes.
- `GET /api/site/knowledge/stats`, `GET /api/site/knowledge/stories/:publicId`
  and `GET /api/site/knowledge/entities/:uuid` supply site previews.
- `GET /api/v1/knowledge/search?q=...&limit=10` requires
  `Authorization: Bearer <KNOWLEDGE_SEARCH_TOKEN>`; only the API service holds
  the secret. Later Ferro can consume these facts, with provenance, independently
  of LlamaIndex. Do not put this token in front-end JavaScript.

## Environment and deployment

Set `GRAPHITI_API_URL=http://knowledge:8000`,
`GRAPHITI_INGEST_ENABLED=true`, `MODEL_CALLS_ENABLED=true`,
`KNOWLEDGE_SEARCH_TOKEN=<random-strong-secret>`, `NVIDIA_API_KEY` and
`NEO4J_PASSWORD` on the development deployment. Neo4j and Graphiti expose no
public ports. Run all AIHot services and the graph services on the **same Compose
project** and network:

```sh
docker compose -f docker-compose.yml -f docker-compose.knowledge.yml --profile knowledge up -d --build
```

The `setup` service applies `0093_graphiti_ingestions.sql` before the
worker ingests an article. Never enable both the retired
`KNOWLEDGE_GRAPH_ENABLED` scheduler and the Graphiti scheduler.

## Acceptance

1. API, worker, PostgreSQL, Neo4j and Graphiti are reachable; `/health`
   responds ready.
2. At least two distinct real, eligible article revisions from different
   sources are in `graphiti_ingestions` and Neo4j as Episodic nodes.
3. Each ingest has an episode ID, article source URL and published timestamp.
   Calling `POST /episodes` again with the same article and revision reports
   `duplicate: true`, without increasing node counts.
4. Story relationships returned by the public site API match Graphiti's
   Neo4j RELATES_TO facts; a non-related article does not acquire an invented
   edge. Absence of a relationship is valid when only one article is present.
5. A known entity has an across-episode relation result when the underlying
   evidence supports it. Validate `validAt`, `invalidAt` and the article
   provenance. Graphiti facts are **paraphrased assertions**, not verbatim quotes.
6. Agent semantic search rejects unauthenticated requests and returns
   sourced Graphiti facts for a relevant query. Test `npm run typecheck`,
   standalone tests and the website event detail view.

Avoid deploying to production until all acceptance cases are demonstrated.
Do not remove the historical AIHot event tree, story grouping, or production
article corpus.
