"""Thin API over Graphiti's temporal graph; news remains owned by AIHot."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os

from fastapi import FastAPI
from pydantic import BaseModel, Field
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType, EpisodicNode
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient


class NvidiaEmbedder(OpenAIEmbedder):
    """NVIDIA embeddings distinguish document passages from search queries."""
    async def create(self, input_data):
        r = await self.client.embeddings.create(
            model=self.config.embedding_model, input=input_data,
            extra_body={"input_type": "query"},
        )
        return r.data[0].embedding[:self.config.embedding_dim]

    async def create_batch(self, texts):
        if not texts:
            return []
        r = await self.client.embeddings.create(
            model=self.config.embedding_model, input=texts,
            extra_body={"input_type": "passage"},
        )
        return [item.embedding[:self.config.embedding_dim] for item in r.data]


class Episode(BaseModel):
    article_id: str = Field(min_length=1, max_length=80)
    revision: int = Field(ge=1)
    title: str = Field(min_length=1)
    url: str = Field(min_length=1)
    source: str
    text: str = Field(min_length=50, max_length=10000)
    published_at: datetime | None = None


class Query(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=10, ge=1, le=30)


class ArticleRelations(BaseModel):
    articles: list[str] = Field(min_length=1, max_length=100)
    limit: int = Field(default=60, ge=1, le=100)


@asynccontextmanager
async def lifespan(app: FastAPI):
    key = os.environ["NVIDIA_API_KEY"]
    base = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model = os.environ.get("GRAPHITI_LLM_MODEL", "openai/gpt-oss-20b")
    llm = OpenAIGenericClient(config=LLMConfig(
        api_key=key, base_url=base, model=model, small_model=model, max_tokens=4096,
    ))
    embedder = NvidiaEmbedder(config=OpenAIEmbedderConfig(
        api_key=key, base_url=base,
        embedding_model="nvidia/nemotron-3-embed-1b", embedding_dim=2048,
    ))
    graph = Graphiti(
        os.environ["NEO4J_URI"], os.environ.get("NEO4J_USER", "neo4j"),
        os.environ["NEO4J_PASSWORD"], llm_client=llm,
        embedder=embedder, cross_encoder=OpenAIRerankerClient(client=llm),
    )
    await graph.build_indices_and_constraints()
    app.state.graph = graph
    try:
        yield
    finally:
        await graph.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.get("/health")
async def health():
    return {"status": "ready", "engine": "graphiti", "backend": "neo4j"}


@app.post("/episodes")
async def add_episode(item: Episode):
    name = f"aihot:{item.article_id}:r{item.revision}"
    # Retry after a successful Graphiti write but lost HTTP response must not
    # duplicate the episode or its extracted relationships.
    rows, _, _ = await app.state.graph.driver.execute_query(
        "MATCH (e:Episodic {name: $name, group_id: 'aihot'}) "
        "RETURN e.uuid AS uuid LIMIT 1", name=name, routing_="r",
    )
    if rows:
        return {"accepted": True, "episode_id": rows[0]["uuid"], "duplicate": True}

    body = "Article: " + item.title + "\nOriginal source: " + item.url + "\n\n" + item.text
    result = await app.state.graph.add_episode(
        name=name, episode_body=body, source=EpisodeType.text,
        source_description=f"{item.source} | {item.url}",
        reference_time=item.published_at or datetime.now(timezone.utc),
        group_id="aihot",
    )
    return {"accepted": True, "episode_id": str(result.episode.uuid), "duplicate": False}


def episode_source(row, fact):
    description = row.get("source_description") or ""
    source, separator, url = description.partition(" | ")
    return {
        "articleId": (row.get("name") or "").removeprefix("aihot:").split(":r")[0],
        "url": url if separator else "",
        "source": source,
        "quote": fact,  # Graphiti-extracted assertion, NOT a verbatim quotation.
        "publishedAt": row["valid_at"].isoformat() if row.get("valid_at") else None,
    }


async def relation_results(rows):
    ids = sorted({u for r in rows for u in (r["episodes"] or [])})
    source_rows = []
    if ids:
        source_rows, _, _ = await app.state.graph.driver.execute_query(
            "MATCH (e:Episodic) WHERE e.uuid IN $uuids AND e.group_id = 'aihot' "
            "RETURN e.uuid AS uuid, e.name AS name, "
            "e.source_description AS source_description, e.valid_at AS valid_at",
            uuids=ids, routing_="r",
        )
    sources = {r["uuid"]: r for r in source_rows}
    edges = []
    for r in rows:
        evidence = [
            episode_source(sources[u], r["fact"])
            for u in (r["episodes"] or []) if u in sources
        ]
        edges.append({
            "id": r["uuid"],
            "subject": {"key": r["subject_uuid"], "name": r["subject_name"], "kind": "entity"},
            "predicate": r["name"] or "related_to",
            "object": {"key": r["object_uuid"], "name": r["object_name"], "kind": "entity"},
            "fact": r["fact"],
            "validAt": r["valid_at"].isoformat() if r["valid_at"] else None,
            "invalidAt": r["invalid_at"].isoformat() if r["invalid_at"] else None,
            "evidence": evidence,
        })
    keys = {e["subject"]["key"] for e in edges} | {e["object"]["key"] for e in edges}
    return {"entities": len(keys), "edges": edges}


EDGE_COLUMNS = (
    "s.uuid AS subject_uuid, s.name AS subject_name, "
    "o.uuid AS object_uuid, o.name AS object_name, "
    "r.uuid AS uuid, r.name AS name, r.fact AS fact, "
    "r.valid_at AS valid_at, r.invalid_at AS invalid_at, "
    "r.episodes AS episodes"
)


@app.post("/relations/by-articles")
async def relations_by_articles(request: ArticleRelations):
    names = ["aihot:" + article for article in request.articles]
    # Each supplied article is "ID:rN". Only Graphiti-owned facts are returned.
    rows, _, _ = await app.state.graph.driver.execute_query(
        "MATCH (ep:Episodic) WHERE ep.group_id='aihot' AND ep.name IN $names "
        "WITH collect(ep.uuid) AS ids "
        "MATCH (s:Entity)-[r:RELATES_TO]->(o:Entity) "
        "WHERE r.group_id='aihot' AND any(u IN coalesce(r.episodes, []) WHERE u IN ids) "
        "RETURN " + EDGE_COLUMNS + " ORDER BY r.created_at DESC LIMIT $limit",
        names=names, limit=request.limit, routing_="r",
    )
    return await relation_results(rows)


@app.get("/entities/{uuid}")
async def relations_by_entity(uuid: str):
    if len(uuid) > 80:
        return {"entity": None, "edges": []}
    nodes, _, _ = await app.state.graph.driver.execute_query(
        "MATCH (n:Entity {uuid:$uuid,group_id:'aihot'}) "
        "RETURN n.name AS name LIMIT 1", uuid=uuid, routing_="r",
    )
    if not nodes:
        return {"entity": None, "edges": []}
    rows, _, _ = await app.state.graph.driver.execute_query(
        "MATCH (s:Entity)-[r:RELATES_TO]->(o:Entity) "
        "WHERE r.group_id='aihot' AND (s.uuid=$uuid OR o.uuid=$uuid) "
        "RETURN " + EDGE_COLUMNS + " ORDER BY r.created_at DESC LIMIT 100",
        uuid=uuid, routing_="r",
    )
    return {"entity": {"key": uuid, "name": nodes[0]["name"], "kind": "entity"},
            **(await relation_results(rows))}


@app.get("/stats")
async def graph_stats():
    counts = {}
    for key, label in (("episodes", "Episodic"), ("entities", "Entity")):
        rows, _, _ = await app.state.graph.driver.execute_query(
            "MATCH (n:" + label + ") WHERE n.group_id='aihot' "
            "RETURN count(n) AS n", routing_="r",
        )
        counts[key] = rows[0]["n"]
    rows, _, _ = await app.state.graph.driver.execute_query(
        "MATCH ()-[r:RELATES_TO]->() WHERE r.group_id='aihot' "
        "RETURN count(r) AS n", routing_="r",
    )
    return {**counts, "relations": rows[0]["n"]}


@app.post("/search")
async def search(query: Query):
    hits = await app.state.graph.search(
        query.text, group_ids=["aihot"], num_results=query.limit,
    )
    uuids = sorted({str(e) for hit in hits for e in (hit.episodes or [])})
    documents = await EpisodicNode.get_by_uuids(
        app.state.graph.driver, uuids,
    ) if uuids else []
    sources = {}
    for episode in documents:
        description = episode.source_description or ""
        source, separator, url = description.partition(" | ")
        sources[str(episode.uuid)] = {
            "name": source, "url": url if separator else None, "title": episode.name,
        }
    return {"sources": sources, "facts": [
        {"id": str(hit.uuid), "fact": hit.fact,
         "valid_at": hit.valid_at.isoformat() if hit.valid_at else None,
         "invalid_at": hit.invalid_at.isoformat() if hit.invalid_at else None,
         "source_uuid": str(hit.source_node_uuid),
         "target_uuid": str(hit.target_node_uuid),
         "episode_ids": [str(e) for e in (hit.episodes or [])]}
        for hit in hits
    ]}



@app.get("/overview")
async def graph_overview():
    """Bounded sample of observed facts for the public knowledge workspace."""
    rows, _, _ = await app.state.graph.driver.execute_query(
        "MATCH (s:Entity)-[r:RELATES_TO]->(o:Entity) "
        "WHERE r.group_id='aihot' "
        "RETURN " + EDGE_COLUMNS + " ORDER BY r.created_at DESC LIMIT 64",
        routing_="r",
    )
    return await relation_results(rows)
