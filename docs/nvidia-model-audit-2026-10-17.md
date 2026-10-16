# NVIDIA API catalogue: 81-model development audit (2026-10-17)

Observed on **cn-dev / VM-0-5-ubuntu**, approximately 2026-10-16 18:24–18:35 UTC. Development NVIDIA API key only; no production model requests and no production deployment. Scripts: [initial auditor](../scripts/nvidia-official-audit.mjs), [documented adapter rechecks](../scripts/nvidia-audit-rechecks.mjs).

## Evidence-based summary

- **81/81 IDs** retrieved from the account's `GET /v1/models` and individually reviewed by task family; first-pass endpoint attempts were made for 80 IDs, while one ID was initially misclassified and skipped.
- First-pass per-ID verdicts: **13** parsed HTTP 200 responses, **54** HTTP 404, **10** network/timeout, **2** HTTP 500, **1** HTTP 400, **1** not called. **404s from a wrong adapter do not prove the model is unavailable on its real endpoint.**
- Documented per-model rechecks added full text completions for **DiffusionGemma**, **Muse Glimmer** and **Ising Calibration** (three additional IDs): **16 IDs have at least one 200 with a response field/vector across both passes**. At least one of these (Nemotron Parse 2.0) received a text-only length-truncated response and is **not** validated for actual document parsing. Nemotron Parse also returned HTTP 200 with an empty content field on its image test: transport success is not a validated extraction.
- Confirmed Embedding vectors: `nvidia/nemotron-3-embed-1b` and `nvidia/llama-nemotron-embed-vl-1b-v2`, each **2048 dimensions**; don't switch Graphiti embedding models or dimensions without an index migration.
- Probe scope: Chat/VLM text checks, image-input acceptance checks, embeddings via `/v1/embeddings`, and safety prompt checks. HTTP 200 is NOT a quality benchmark. Successful textual generation does NOT prove visual understanding, and short/missing content must not be counted as business readiness.

## Model-by-model results

**Status** is the first pass; **official adapter recheck** is a second, more faithful test where the original adapter was inaccurate. An absent recheck means no additional endpoint invocation. Reference links are supplied for verified model-specific cases in the notes below; other categories point to the family documentation, NOT to invented model-specific pages.

| # | Model ID | Audited family | First pass | Official adapter recheck |
|---:|---|---|---|---|
| 1 | `01-ai/yi-large` | text | 404 | — |
| 2 | `adept/fuyu-8b` | unknown | 404 | — |
| 3 | `ai21labs/jamba-1.5-large-instruct` | unknown | 404 | — |
| 4 | `aisingapore/sea-lion-7b-instruct` | unknown | 404 | — |
| 5 | `bigcode/starcoder2-15b` | text | 404 | — |
| 6 | `databricks/dbrx-instruct` | unknown | 404 | — |
| 7 | `deepseek-ai/deepseek-coder-6.7b-instruct` | text | 404 | — |
| 8 | `deepseek-ai/deepseek-v4.1-flash` | text | timeout / uncertain | — |
| 9 | `google/codegemma-1.1-7b` | text | 404 | — |
| 10 | `google/codegemma-7b` | text | 404 | — |
| 11 | `google/deplot` | unknown | 404 | — |
| 12 | `google/diffusiongemma-26b-a4b-it` | vision | not called | HTTP 200 + text |
| 13 | `google/gemma-2b` | text | 404 | — |
| 14 | `google/gemma-3-12b-it` | text | 404 | — |
| 15 | `google/gemma-3-4b-it` | text | 404 | — |
| 16 | `google/gemma-4-31b-it` | text | timeout / uncertain | — |
| 17 | `google/recurrentgemma-2b` | text | 404 | — |
| 18 | `ibm/granite-3.0-3b-a800m-instruct` | text | 404 | — |
| 19 | `ibm/granite-3.0-8b-instruct` | text | 404 | — |
| 20 | `ibm/granite-34b-code-instruct` | text | 404 | — |
| 21 | `ibm/granite-8b-code-instruct` | text | 404 | — |
| 22 | `meta/codellama-70b` | text | 404 | — |
| 23 | `meta/llama-3.2-11b-vision-instruct` | vision | 200 + response | — |
| 24 | `meta/llama-3.2-90b-vision-instruct` | vision | timeout / uncertain | — |
| 25 | `meta/llama-guard-4-12b` | safety | timeout / uncertain | — |
| 26 | `meta/llama2-70b` | text | 404 | — |
| 27 | `meta/muse-glimmer-30b` | vision | timeout / uncertain | HTTP 200 + text |
| 28 | `microsoft/kosmos-2` | unknown | 404 | — |
| 29 | `microsoft/phi-3-vision-128k-instruct` | vision | 404 | — |
| 30 | `microsoft/phi-3.5-moe-instruct` | text | 404 | — |
| 31 | `mistralai/codestral-22b-instruct-v0.1` | text | 404 | — |
| 32 | `mistralai/mistral-7b-instruct-v0.3` | text | 404 | — |
| 33 | `mistralai/mistral-large` | text | 404 | — |
| 34 | `mistralai/mistral-large-2-instruct` | text | 404 | — |
| 35 | `mistralai/mixtral-8x22b-v0.1` | text | 404 | — |
| 36 | `moonshotai/kimi-k2.6` | text | 404 | — |
| 37 | `nv-mistralai/mistral-nemo-12b-instruct` | text | 404 | — |
| 38 | `nvidia/ai-synthetic-video-detector` | unknown | HTTP 500 | — |
| 39 | `nvidia/cosmos-reason2-8b` | unknown | 404 | — |
| 40 | `nvidia/embed-qa-4` | embedding | 404 | — |
| 41 | `nvidia/ising-calibration-1.5-31b` | vision | timeout / uncertain | HTTP 200 + text |
| 42 | `nvidia/llama-3.1-nemoguard-8b-content-safety` | safety | timeout / uncertain | — |
| 43 | `nvidia/llama-3.1-nemoguard-8b-topic-control` | safety | HTTP 500 | — |
| 44 | `nvidia/llama-3.1-nemotron-51b-instruct` | text | 404 | — |
| 45 | `nvidia/llama-3.1-nemotron-70b-instruct` | text | 404 | — |
| 46 | `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` | safety | 200 + response | — |
| 47 | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | text | 404 | — |
| 48 | `nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1` | embedding | 404 | — |
| 49 | `nvidia/llama-3.2-nv-embedqa-1b-v1` | embedding | 404 | — |
| 50 | `nvidia/llama-nemotron-embed-vl-1b-v2` | embedding | 200 + response | — |
| 51 | `nvidia/llama3-chatqa-1.5-70b` | text | 404 | — |
| 52 | `nvidia/mistral-nemo-minitron-8b-8k-instruct` | text | 404 | — |
| 53 | `nvidia/nemotron-3-embed-1b` | embedding | 200 + response | — |
| 54 | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | vision | 200 + response | — |
| 55 | `nvidia/nemotron-3-super-120b-a12b` | text | 200 + response | — |
| 56 | `nvidia/nemotron-3-ultra-550b-a55b` | text | 404 | — |
| 57 | `nvidia/nemotron-3.5-content-safety` | safety | 200 + response | — |
| 58 | `nvidia/nemotron-3.5-lightning-30b-a3b` | text | timeout / uncertain | — |
| 59 | `nvidia/nemotron-3.5-super-vl-120b-a12b` | vision | 200 + response | — |
| 60 | `nvidia/nemotron-4-340b-instruct` | text | 404 | — |
| 61 | `nvidia/nemotron-4-340b-reward` | text | 404 | — |
| 62 | `nvidia/nemotron-nano-3-30b-a3b` | text | 404 | — |
| 63 | `nvidia/nemotron-parse` | document | 400 / invalid request | HTTP 200 / empty or incomplete |
| 64 | `nvidia/nemotron-parse-2.0` | document | 200 + response | HTTP 400 / payload mismatch (image request requires further adjustment) |
| 65 | `nvidia/neva-22b` | unknown | 404 | HTTP 404 |
| 66 | `nvidia/nv-embedqa-mistral-7b-v2` | embedding | 404 | — |
| 67 | `nvidia/nvclip` | embedding | 404 | HTTP 404 |
| 68 | `nvidia/riva-translate-4b-instruct` | text | 404 | — |
| 69 | `nvidia/riva-translate-4b-instruct-v2` | text | 200 + response | — |
| 70 | `nvidia/vila` | unknown | 404 | — |
| 71 | `openai/gpt-oss-20b` | text | 200 + response | — |
| 72 | `poolside/laguna-xs-2.1` | text | 200 + response | — |
| 73 | `snowflake/arctic-embed-l` | embedding | 404 | — |
| 74 | `stepfun-ai/step-5-preview` | text | 200 + response | — |
| 75 | `writer/palmyra-creative-122b` | unknown | 404 | — |
| 76 | `writer/palmyra-fin-70b-32k` | unknown | 404 | — |
| 77 | `writer/palmyra-med-70b` | unknown | 404 | — |
| 78 | `writer/palmyra-med-70b-32k` | unknown | 404 | — |
| 79 | `z-ai/glm-5.3` | text | timeout / uncertain | — |
| 80 | `z-ai/glm-5.3-flash` | vision | timeout / uncertain | — |
| 81 | `zyphra/zamba2-7b-instruct` | unknown | 404 | — |

## Official request shapes checked

- **Chat:** [NVIDIA LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis): `POST https://integrate.api.nvidia.com/v1/chat/completions`. Some chat models require special generation parameters; prompts demanding strict Chinese JSON are not valid general availability tests.
- **Vision:** [NVIDIA Multimodal APIs](https://docs.api.nvidia.com/nim/reference/multimodal-apis): user content parts include `image_url`; verify image handling separately from text. [Neva 22B](https://docs.api.nvidia.com/nim/reference/nvidia-neva-22b-infer) instead documents `/v1/vlm/nvidia/neva-22b`, tested separately and still returned 404 for this account.
- **Embeddings:** [Nemotron Embed 1B](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b-infer): `POST /v1/embeddings`, `model`, `input`, `input_type` (query/passage when supported). [NVCLIP](https://docs.api.nvidia.com/nim/reference/nvidia-nvclip-infer) uses the embedding API with a different payload; verified correct adapter still returned 404 for this account.
- **Retrieval reranking:** [NVIDIA rerank reference](https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-rerank-1b-v2-infer) documents a separate `/v1/retrieval/.../reranking` endpoint; **none of this account's 81 IDs were identified as rerank models**.
- **Document parsing:** [Nemotron Parse](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-parse-infer) requires an image, not a plain text prompt; [Nemotron Parse 2.0 model card](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-parse-2_0) additionally documents minimum 1024×1280 image input and extraction control tokens. A valid full-size image was sent but Parse 2.0 returned HTTP 400 (input/output token budget exceeds current 4096 context); this needs adapter-specific tuning, not a general model blacklist.
- **Other misclassified models:** [DiffusionGemma](https://docs.api.nvidia.com/nim/reference/diffusiongemma-26b-a4b-it-infer) generates TEXT via chat despite `diffusion` in its name; [Muse Glimmer](https://docs.api.nvidia.com/nim/reference/meta-muse-glimmer-30b-infer) needs reasoning headroom; [Ising Calibration](https://docs.api.nvidia.com/nim/reference/nvidia-ising-calibration-1-5-31b-infer) is vision-language; [Riva Translate v2](https://docs.api.nvidia.com/nim/reference/nvidia-riva-translate-4b-instruct-v2-infer) translates text through chat.

## Engineering acceptance policy

Use a per-model **adapter registry**, not substring classification alone: `model_id`, `capabilities` (multi-valued), `exact_endpoint`, `request_schema`, `observed_at`, `http_status`, `latency_ms`, `text_verified`, `image_verified`, `embedding_dimension`, `access_scope`. Don't turn a synthetic timeout into a hard failure; don't turn a catalogue listing or HTTP 200 empty response into a healthy route. Refresh stale checks with per-model cooldown and preserve completed business receipts. Only move models into production routes after development acceptance and deployment verification. No credentials, account identifiers, raw provider errors or user payloads are included here.
