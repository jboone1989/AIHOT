# Knowledge relation review

The same public Graphiti `RELATES_TO` edges are used in the atlas and every entity profile. The entity center changes the **viewport and one-hop fetch**, not the meaning of edges. Exploratory navigation accumulates previously loaded nodes/edges and never synthesizes edges from co-occurrence.

A sourced Graphiti assertion can still have the wrong subject or object. Preserve its original evidence and graph UUID for audit instead of deleting the relationship or fabricating an expiration date. After checking the cited article against the claim, mark the bad Neo4j edge:

```cypher
MATCH (s:Entity)-[r:RELATES_TO {uuid: $relation_id}]->(o:Entity)
WHERE s.name = $expected_subject AND o.name = $expected_object
SET r.editorial_rejected = true,
    r.editorial_review_reason = $reason,
    r.editorial_reviewed_at = datetime()
RETURN r.uuid, r.editorial_rejected
```

All public relationship lookup paths exclude `editorial_rejected = true`. To reverse a mistaken review, set it to false after checking the evidence; the source assertion is still stored.

## Audited example (2026-10-16, cn-dev)

Graphiti assigned relation `66c637f7-bc07-4078-8881-2ae974c9cece` from **Omi → Strategy** with the fact: "Funds tracking MSCI’s Global Investable Market Indexes hold approximately 13 million shares of Strategy." The text attributes ownership to MSCI-tracking funds, **not Omi**. This is a subject attribution error, not evidence of a direct Omi–Strategy relation. This edge was marked `editorial_rejected=true` in the development Neo4j graph; the accurate Omi–MSCI and MSCI–Strategy relations remain intact.

Reviews are stored in Neo4j instance data, **not** in this repository. On independent deployment databases, corrections must be reviewed and applied there separately. The API's public-evidence filtering remains in force.
