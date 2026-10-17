**This repository's security boundaries (see AGENTS.md):**
- Secrets, database access and model calls live only in the backend (`packages/backend`, `apps/api`, `apps/worker`). Flag any path that sends a key, a `.env` value, an admin session or a provider credential to `apps/web`, a public route, a log line, an error message or a commit.
- Every public output (pages, RSS, `/api/v1`, Agent Markdown, MCP) reads through `packages/backend/src/publication/`. Flag a public route that queries tables directly or returns admin-only or unpublished fields.
- Admin routes (`apps/api/src/routes/admin*.ts`) must check the admin session; flag any handler reachable without it, and any change to session binding or password handling in `packages/backend/src/admin/auth.ts`.
- Paid requests go through `packages/backend/src/providers/receipts.ts` and its budget breaker. Flag a model or paid API call that bypasses them, or that a reader's page view can trigger.
- Safety valves (`COLLECT_ENABLED`, `MODEL_CALLS_ENABLED`, `FEISHU_*_ENABLED`, `INDEXNOW_SUBMIT_ENABLED`) open only on the exact value `true`. Flag a default or parse change that opens one.
- Server-side fetches of source URLs, images and feeds (`packages/backend/src/lib/http-fetch.ts`, `media/`, `sources/`) are an SSRF surface: flag requests to user-supplied hosts without the existing URL checks, and redirects that escape them.
- Source HTML is rendered after `content/sanitize.ts`; flag any path that renders source or model text as HTML without it.
- Deploy files (`scripts/deploy-prod.sh`, `docker-compose*.yml`, `deploy/`) must keep PostgreSQL and the app listener off public interfaces and must never target `43.133.185.154`.
