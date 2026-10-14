# NVIDIA free-prototype model pool (AIHot)

The worker checks NVIDIA's live `/v1/models` catalogue every two hours, and runs at most one actual text/JSON probe per five-minute schedule tick. The catalogue includes non-chat endpoints; the pool only tests text-capable candidates, *not* every listed model. Each probe is a real API request charged against AIHot's `nvidia` request-counter budget. Provider-level free-trial limits still apply.

Health evidence lives in the existing PostgreSQL `settings` row `nvidia.model_pool.v1`. Successful completed editorial receipts are also evidence of model usability. Each candidate records its last result and response time. Success becomes stale after four hours; failed/timeout responses are kept for diagnosis and retried later. One timeout is not permanent proof that a model is unusable.

When `NVIDIA_MODEL_POOL_ENABLED=true`, `modelFor` routes NVIDIA-assigned editorial steps to a recently successful candidate. The preferred model is kept while healthy; otherwise, choose a verified fallback with low latency. If no model has fresh proof, tasks wait rather than sending an unapproved paid-provider request. Admin overrides to non-NVIDIA models are unaffected.

To inspect the state without exposing credentials, in an API container run `node scripts/nvidia-pool.ts`. To force one bounded check run `node scripts/nvidia-pool.ts --probe`. The worker cron queue is `cron.models.nvidia.probe` and its job result is recorded in `job_runs`.

NVIDIA NIM hosted developer endpoints are for prototyping and have variable limits and congestion. Neither the number of models in the catalogue nor the presence of a Developer Program key establishes unlimited free production usage. Do not build a quota-evasion or many-key workaround. Keep probes small and separate from Ferro's ChatGPT-only production route.
