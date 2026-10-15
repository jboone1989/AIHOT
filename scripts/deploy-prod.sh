#!/usr/bin/env bash
# One-command VM09 release: build immutable images on cn-dev, transfer them over
# existing SSH, then recreate the SAME Compose services without database restore.
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
DEV="ubuntu@43.142.127.40"
DEV_ROOT="/home/ubuntu/livingruntime-aihot"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=12 -o ServerAliveInterval=15 "${DEV}")
COMPOSE=(docker compose
  -f docker-compose.yml
  -f docker-compose.production.yml
  -f docker-compose.knowledge.yml
  -f docker-compose.release.yml
  --profile knowledge)

if [[ "${1:-}" != "" && "${1:-}" != "--check" ]]; then
  echo "Usage: bash scripts/deploy-prod.sh [--check]" >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing deployment with uncommitted tracked source changes" >&2
  exit 1
fi
test -f .env && test -f scripts/production-smoke.py
command -v docker >/dev/null
git fetch origin main
SHA="$(git rev-parse origin/main)"
TAG="${SHA:0:12}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid source commit ID" >&2; exit 1
fi
if [[ "${1:-}" == "--check" ]]; then
  "${COMPOSE[@]}" config --quiet
  "${SSH[@]}" "git -C '$DEV_ROOT' rev-parse --is-inside-work-tree"
  python3 scripts/production-smoke.py
  echo "Preflight OK. Remote source version: $SHA"
  exit 0
fi

echo "[1/5] Build immutable application and Graphiti images on cn-dev: $TAG"
"${SSH[@]}" "bash -s -- '$SHA' '$TAG' '$DEV_ROOT'" <<'BUILD_ON_DEV'
set -Eeuo pipefail
SHA="$1"; TAG="$2"; ROOT="$3"
[[ "$SHA" =~ ^[0-9a-f]{40}$ && "$TAG" =~ ^[0-9a-f]{12}$ ]]
git -C "$ROOT" fetch origin main
[[ "$(git -C "$ROOT" rev-parse origin/main)" == "$SHA" ]] || {
  echo "Remote source does not match the requested release" >&2; exit 1;
}
TMP="$(mktemp -d /tmp/livingruntime-build.XXXXXXXX)"
trap 'rm -rf "$TMP"' EXIT
git -C "$ROOT" archive "$SHA" | tar -xf - -C "$TMP"
docker build -t "livingruntime-app:$TAG" -f "$TMP/Dockerfile" "$TMP"
docker build -t "livingruntime-knowledge:$TAG" -f "$TMP/knowledge_service/Dockerfile" "$TMP"
docker image inspect "livingruntime-app:$TAG" "livingruntime-knowledge:$TAG" >/dev/null
BUILD_ON_DEV

echo "[2/5] Stream only the built images from cn-dev to VM09 over SSH"
"${SSH[@]}" "docker image save livingruntime-app:$TAG livingruntime-knowledge:$TAG | gzip -1" \
  | gzip -dc | docker image load
docker image inspect "livingruntime-app:$TAG" "livingruntime-knowledge:$TAG" >/dev/null

echo "[3/5] Advance only this release directory to the exact image commit"
git merge --ff-only origin/main
[[ "$(git rev-parse HEAD)" == "$SHA" ]] || exit 1

echo "[4/5] Select release images and restart existing Compose services"
python3 - "$TAG" <<'SET_VERSION'
from pathlib import Path
import os, re, sys
tag=sys.argv[1]
assert re.fullmatch(r"[0-9a-f]{12}",tag)
p=Path(".env")
assert p.is_file() and p.stat().st_mode & 0o077 == 0
data=p.read_text()
if re.search(r"^LRSITE_RELEASE=",data,re.M):
    data=re.sub(r"^LRSITE_RELEASE=.*$", "LRSITE_RELEASE="+tag, data, flags=re.M)
else:
    data += "\nLRSITE_RELEASE="+tag+"\n"
p.write_text(data)
os.chmod(p,0o600)
print("Release pinned:",tag)
SET_VERSION
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --no-build --pull never \
  db api web worker knowledge-neo4j knowledge

echo "[5/5] Verify substantive content and graph data before success"
OK=0
for n in 1 2 3 4 5 6 7 8 9 10; do
  if python3 scripts/production-smoke.py; then
    OK=1
    break
  fi
  sleep 6
done
if [[ "$OK" != "1" ]]; then
  echo "Deployment health check failed; no database volumes were replaced" >&2
  exit 1
fi
echo "SUCCESS: VM09 production updated to $SHA (Docker Compose, existing data volumes)"
