"""Thin AIHot bridge over the upstream Graphiti core. No custom graph engine."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType, EpisodicNode
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder.openai_reranker_client import OpenAIRerankerClient


class NvidiaEmbedder(OpenAIEmbedder):
    """NVIDIA's hosted embeddings require input_type=passage/query."""
    async def create(self, input_data):
        r = await self.client.embeddings.create(
            model=self.config.embedding_model, input=input_data,
            extra_body={"input_type": "query"},
        )
        return r.data[0].embedding[: self.config.embedding_dim]

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    key = os.environ["NVIDIA_API_KEY"]
    base = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    llm = OpenAIGenericClient(config=LLMConfig(
        api_key=key, base_url=base, model=os.environ.get("GRAPHITI_LLM_MODEL", "openai/gpt-oss-20b"),
        small_model=os.environ.get("GRAPHITI_LLM_MODEL", "openai/gpt-oss-20b"),
        max_tokens=4096,
    ))
    embedder = NvidiaEmbedder(config=OpenAIEmbedderConfig(
        api_key=key, base_url=base,
        embedding_model="nvidia/nemotron-3-embed-1b", embedding_dim=2048,
    ))
    graph = Graphiti(os.environ["NEO4J_URI"], os.environ.get("NEO4J_USER", "neo4j"),
                    os.environ["NEO4J_PASSWORD"], llm_client=llm,
                    embedder=embedder, cross_encoder=OpenAIRerankerClient(client=llm))
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
    # Persist article identity and original URL in the source episode; Graphiti owns
    # extracting, deduplicating, and temporally managing entities and relationships.
    body = "Article: " + item.title + "\nOriginal source: " + item.url + "\n\n" + item.text
    result = await app.state.graph.add_episode(
        name=f"aihot:{item.article_id}:r{item.revision}",
        episode_body=body, source=EpisodeType.text,
        source_description=f"{item.source} | {item.url}",
        reference_time=item.published_at or datetime.now(timezone.utc),
        group_id="aihot",
    )
    return {"accepted": True, "episode_id": str(result.episode.uuid)}


@app.post("/search")
async def search(query: Query):
    hits = await app.state.graph.search(query.text, group_ids=["aihot"], num_results=query.limit)
    uuids = sorted({str(e) for hit in hits for e in (hit.episodes or [])})
    documents = await EpisodicNode.get_by_uuids(app.state.graph.driver, uuids) if uuids else []
    sources = {}
    for episode in documents:
        description = episode.source_description or ""
        source, separator, url = description.partition(" | ")
        sources[str(episode.uuid)] = {"name": source, "url": url if separator else None,
                                       "title": episode.name}
    return {"sources": sources, "facts": [
        {"id":str(hit.uuid), "fact":hit.fact,
         "valid_at":hit.valid_at.isoformat() if hit.valid_at else None,
         "invalid_at":hit.invalid_at.isoformat() if hit.invalid_at else None,
         "source_uuid":str(hit.source_node_uuid),
         "target_uuid":str(hit.target_node_uuid),
         "episode_ids":[str(e) for e in (hit.episodes or [])]}
        for hit in hits]}
