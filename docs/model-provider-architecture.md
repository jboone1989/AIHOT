# AIHOT independent model providers

Each model is a separately configured Provider. A provider identity is (vendor, model_id);
one row contains endpoint, adapter, credential reference, capabilities, request defaults,
timeout, SSE policy, complexity level, enabled and route-enabled flags, documentation,
revision, and audit attribution. There is no central code switch with 81 model names.

## Persistence
- `model_providers` holds the desired configuration; one row per model.
- `model_provider_checks` holds independent text, vision, embedding, safety, etc. observations.
  A text success must never turn vision into an enabled capability.
- `audit_log` records every admin creation/change/probe, including actor and reason.
- `credential_env` stores only the *name* of an environment credential. API key values
  stay in per-environment secrets, never in PostgreSQL or frontend props.
- Online migrations 0101–0103 create the two tables and concurrent index separately.
- The initial set of 81 NVIDIA models is in `config/model-provider-seed.json`.
  Import it into each environment's database after migrations:
  `node --env-file-if-exists=.env scripts/seed-model-providers.ts`.
  Import uses `ON CONFLICT DO NOTHING`: repeated seeding never resets admin settings.
  All seeded models begin disabled and unroutable.

## Runtime
- `registry/types.ts`: capability and individual Provider profile contract.
- `registry/repository.ts`: independent read/write and version conflict checks.
- `registry/validation.ts`: allowlisted NVIDIA endpoints, known request keys,
  bounded timeout and payload fields; backend alone can write health checks.
- `registry/adapter.ts`: factory returns one instance per configured model:
  ChatProvider (ordinary/SSE), EmbeddingProvider, DocumentProvider, SafetyProvider,
  or UnconfiguredProvider. Common HTTP/receipt plumbing is reused rather than
  duplicating 81 fetch implementations.
- `registry/probe.ts`: an authenticated smoke request for one capability of one
  model, with budget receipt and separate health record.
- `registry/selection.ts`: stage-specific DB lookup, active and recent verification
  checks, and lightweight-vs-heavy task preference.
- `llm.ts` dispatches chat to that model's Provider instance when
  `MODEL_PROVIDER_REGISTRY_ENABLED=true` and the model is verified. Embedding
  adapters expose embedding methods without changing the Graphiti index by default.
- The legacy global NVIDIA pool is explicitly bypassed when the new registry mode
  is on. It remains for backwards-compatible production calls while migration is tested.

## Admin
`/admin/models` contains one compact, searchable Provider editor for all 81 rows.
It edits endpoint, adapter, capabilities, own JSON options, stream and timeout,
complexity, enable and route state, and audits the reason. It has add-provider and
single-capability probe actions. The backend rejects an attempt to route a model
before an independently successful recent capability test. Endpoint hosts and
credential environment names are not arbitrary user-controlled network destinations.

## Activation (independent dev / prod)
1. Deploy the additive migrations to development.
2. Import the 81 disabled providers; verify count, disabled status and UI editing.
3. Enable individual dev Provider rows and run their official task-specific probes.
4. Verify text/vision isolation, receipt handling, SSE, timeouts, and actual editorial
   task quality. Enable routes only on passing providers.
5. Turn on `MODEL_PROVIDER_REGISTRY_ENABLED=true` on development to test the
   real stage selection. Legacy production remains untouched.
6. Only after development validation and a separate production release: migrate
   production, import disabled providers, configure and verify production credentials,
   then activate via controlled production flags.

HTTP 200 with empty content is not success; OCR, video, rerank and modality-specific
endpoints cannot be certified by generic Chat JSON probes. Those Provider rows are
present but unconfigured or disabled until their official adapters and sample
inputs pass task-specific tests. This is intentional, not deleting models.
