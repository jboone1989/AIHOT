# LivingRuntime production deployment (VM09)

Canonical target: VM09. The international server 43.133.185.154 is reserved for Ferro and is not part of this website deployment.

## One production architecture

Cloudflare DNS/TLS/Tunnel -> VM09 loopback port 3000 -> Docker Compose web -> API + PostgreSQL, plus one worker. Optional Graphiti + Neo4j is an explicitly enabled knowledge profile once memory and credentials are confirmed. PostgreSQL is persisted in a named volume; no public database ports. Only a single worker can own scheduled jobs.

The Cloudflare Tunnel remains a separate host-level edge service, with a stable loopback origin. Application roles, migrations and PostgreSQL are managed only by Docker Compose, not also by native Node systemd services. There is one Git release SHA and one compose project named livingruntime.

VM09 has about 3.6 GiB memory and 2 GiB swap. The production overlay caps resource use. Neo4j and Graphiti are NOT automatically started while the existing system is still running. Model spending must remain off until explicit authorization and valid inference credentials.

## Preflight and first installation

1. Use the Git main branch and a clean release directory.
2. Docker and Docker Compose v2 are installed. The deployment operator must have legitimate access to /var/run/docker.sock. Do not chmod the socket world-writable, bypass privilege controls, or expose it over TCP. Grant Docker group access with a one-time authorized administrator action and reconnect the operator's session.
3. Create a private release .env with mode 0600 containing the existing valid production auth/API credentials (do not commit it). Run python3 scripts/production-env-init.py --env-file .env --port 13000 to generate a strong, unique PostgreSQL password and pin the release SHA. SITE_URL stays https://www.livingruntime.com; AdSense verification remains false. Never use the development password.
4. Always use the same two Compose files, in this order: docker-compose.yml and docker-compose.production.yml. Validate them with docker compose config --quiet and build the release.
5. Start only the new db and import a verified backup of the old PostgreSQL database. The scripts production-db-backup.py and production-db-restore.py back up and restore without displaying passwords. Verify row counts and applied migrations. Do not start a second worker yet.
6. Start setup, api, web on staging loopback port 13000; inspect home, news, events, privacy, admins, API, and disabled AdSense verification. Never publish this staging port publicly.

## Cutover, monitoring and rollback

Stop the legacy worker and API before the final data backup and import. No two workers should process the same queue. Stop BOTH staging web and staging API before the final import; keep only the isolated Compose database running. Refresh the isolated database from the FINAL backup with `python3 scripts/production-db-restore.py --archive /path/to/final.dump --compose docker-compose.yml --compose docker-compose.production.yml --replace --confirm-destination livingruntime`. The replace option resets only the Compose database public schema, not the original host database; it refuses to run while any Compose API/worker/web service is running. Reapply migrations with `docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm setup`, verify record counts and start the new API. Stop the old web process, update the new web port to 3000 and start the new web and one worker. Cloudflare Tunnel already points at 127.0.0.1:3000 and need not change.

Watch public home HTTP status, APIs, selected reports, jobs, nginx/Cloudflare health, DB volume, and RAM. Check that /ads.txt returns 404 and no Google ads script loads until AdSense is approved.

For rollback before new writes: stop the new worker, API and web, restart the old native services without deleting their original database; keep the Cloudflare origin. After new writes, synchronize data before rollback to prevent lost writes. NEVER run docker compose down -v against this production project. Keep the backup archive outside Git, permissions 0600.

## Optional knowledge deployment

Only enable the knowledge profile after confirming memory headroom, GRAPHITI_API_URL, Neo4j credentials, model endpoint and costs. This is not silently pointed at the development knowledge DB. Publishing news may continue with graph status disabled until the provider is ready.

## Validation commands

- docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
- npm run typecheck
- npm run test:standalone
- node scripts/adsense-smoke.mjs
- node scripts/english-site-smoke.mjs

Copying a Git repository or starting a loopback preview is not a production cutover. Production is complete only when the live Cloudflare domain is serving the validated Compose stack.
