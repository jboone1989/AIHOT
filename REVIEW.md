# EventGraph review contract

Use `AGENTS.md` as the authoritative repository-wide engineering instructions. Review only problems introduced by the PR, with specific paths, lines, reproduction steps and severity. Distinguish proven defects from speculation.

## Project invariants
- Keep existing acquisition, deduplication, event trees and transactional/business records in PostgreSQL; Graphiti + Neo4j are the intended temporal entity-relationship layer. Do not introduce a parallel graph engine without an explicit architecture decision.
- Graph UI should load a bounded neighborhood centered on the selected entity, and let selection change the center; do not eagerly render every entity. Check pagination, request cancellation, index use and client/server bounds.
- Public pages must obtain analytics from real event pipelines and persisted data; never silently substitute hardcoded or simulated metrics. Verify collection, ingestion, aggregation, API and UI end to end.
- Changes to shared navigation, graph interactions, or published content must preserve functionality in both Chinese and English.
- Frontend reads the API over HTTP; credentials and database access stay on the server. Reader requests must not trigger model calls.
- Investigate N+1 queries, unbounded scans, expensive graph expansion, and deployment/worker configuration drift.
- Database changes must respect the migration rules in AGENTS.md; do not alter applied migration files.
- Keep the established architecture and avoid redundant abstractions, flags and compatibility layers without demonstrated need.

## Review style
- Prioritize P0/P1 concrete bugs, data-loss or security risks and major regressions; report P2 when actionable. Omit cosmetic nits.
- For each finding specify severity, changed file and line, causal mechanism, impact, and smallest viable correction.
- If no actionable issue is found, explicitly say so. Do not claim tests were run unless actually executed.
- Review is advisory during the pilot: never edit code, merge pull requests or deploy.
