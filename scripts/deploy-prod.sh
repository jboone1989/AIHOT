#!/usr/bin/env bash
# Incremental EventGraph release. Version every service separately; NEVER recreate DB/Neo4j
# unless an explicitly requested migration/DB maintenance operation warrants it.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
MODE="${1:---deploy}"
case "$MODE" in --deploy|--plan|--check) ;; *) echo "Usage: bash scripts/deploy-prod.sh [--plan|--check|--deploy]" >&2; exit 2;; esac
ENV_FILE=".env.production"
test -f "$ENV_FILE" || { echo "Missing private $ENV_FILE (production settings must be explicit)" >&2; exit 1; }
export AIHOT_ENV_FILE="$ENV_FILE"
node scripts/check-environment.mjs --target=production --file="$ENV_FILE"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.knowledge.yml -f docker-compose.release.yml --profile knowledge)
"${COMPOSE[@]}" config --quiet
if [[ "$MODE" == --check ]]; then
 python3 scripts/production-smoke.py
 exit 0
fi
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo "Tracked files modified; refusing release" >&2; exit 1; }
# Production git source is advanced independently to a reviewable merged commit.
git fetch https://github.com/jboone1989/AIHOT.git main
git merge --ff-only FETCH_HEAD
SHA="$(git rev-parse HEAD)"
TAG="${SHA:0:12}"
BASE="$(sed -n 's/^LRSITE_DEPLOYED_SHA=//p' "$ENV_FILE" | head -n1)"
[[ "$BASE" =~ ^[a-f0-9]{40}$ ]] || { echo "Missing production baseline SHA; initialize LRSITE_DEPLOYED_SHA" >&2; exit 1; }
git merge-base --is-ancestor "$BASE" "$SHA" || { echo "Release is not fast-forward" >&2; exit 1; }
mapfile -t CHANGED < <(git diff --name-only "$BASE" "$SHA")
API=0;WORKER=0;WEB=0;KNOWLEDGE=0;SETUP=0;APP_FULL=0;KNOW_FULL=0
app_files=();know_files=()
for path in "${CHANGED[@]}"; do
 case "$path" in
  apps/api/*) API=1;app_files+=("$path");;
  apps/worker/*) WORKER=1;app_files+=("$path");;
  apps/web/*) WEB=1;app_files+=("$path");;
  packages/backend/*) API=1;WORKER=1;app_files+=("$path");;
  packages/contracts/*|site/*|industry/*|modules/*) API=1;WORKER=1;WEB=1;app_files+=("$path");;
  knowledge_service/*) KNOWLEDGE=1;know_files+=("$path");;
  scripts/migrate.ts|database/migrations/*) SETUP=1;app_files+=("$path");;
  docker-compose.yml|docker-compose.production.yml|docker-compose.release.yml)
    API=1;WORKER=1;WEB=1;;
  Dockerfile|package-lock.json|package.json|packages/*/package.json|apps/*/package.json)
    APP_FULL=1;API=1;WORKER=1;WEB=1;;
  knowledge_service/requirements.txt|knowledge_service/Dockerfile) KNOW_FULL=1;KNOWLEDGE=1;;
  config/*|tests/*|scripts/*|.github/*|README*|docs/*) ;;
  *) APP_FULL=1;API=1;WORKER=1;WEB=1;;
 esac
done
if ((API||WORKER||WEB||SETUP));then
 for path in "${app_files[@]}";do
   [[ -f "$path" && "$path" != *.lock ]] || APP_FULL=1
 done
fi
if ((KNOWLEDGE));then
 for path in "${know_files[@]}";do [[ -f "$path" ]] || KNOW_FULL=1;done
fi
echo "Release $BASE -> $SHA; changed files=${#CHANGED[@]}; affected: api=$API worker=$WORKER web=$WEB knowledge=$KNOWLEDGE migrations=$SETUP"
if [[ "$MODE" == --plan ]];then exit 0;fi
# A normal TS change takes a small offline overlay on the already deployed base image.
# For dependency changes build only the affected full image on cn-dev.
DEV="ubuntu@43.142.127.40"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=12 -o ServerAliveInterval=15 "$DEV")
if ((API||WORKER||WEB||SETUP));then
 if ((APP_FULL));then
  echo "Application dependency/build change: building only application image on cn-dev"
  "${SSH[@]}" "git -C /home/ubuntu/livingruntime-aihot fetch origin main && git -C /home/ubuntu/livingruntime-aihot archive '$SHA' | tar -xf - -C /tmp" >/dev/null
  echo "Full application build requires reviewed image pipeline";exit 2
 fi
 BASE_TAG="$(sed -n 's/^LRSITE_RELEASE_API=//p' "$ENV_FILE"|head -n1)"
 BASE_TAG="${BASE_TAG:-$(sed -n 's/^LRSITE_RELEASE=//p' "$ENV_FILE"|head -n1)}"
 docker image inspect "livingruntime-app:$BASE_TAG" >/dev/null
 TMP="$(mktemp -d /tmp/eventgraph-release.XXXXXXXX)"
 trap 'rm -rf "$TMP"' EXIT
 echo "FROM livingruntime-app:$BASE_TAG" > "$TMP/Dockerfile"
 for path in "${app_files[@]}";do
  [[ -f "$path" ]] || continue
  printf 'COPY --chown=node:node %s /app/%s\n' "$path" "$path" >> "$TMP/Dockerfile"
 done
 docker build --network none --pull=false -q -f "$TMP/Dockerfile" -t "livingruntime-app:$TAG" .
fi
if ((KNOWLEDGE));then
 if ((KNOW_FULL));then echo "Graphiti dependency change needs its own full image build";exit 2;fi
 OLD_KNOW="$(sed -n 's/^LRSITE_RELEASE_KNOWLEDGE=//p' "$ENV_FILE"|head -n1)"
 OLD_KNOW="${OLD_KNOW:-$(sed -n 's/^LRSITE_RELEASE=//p' "$ENV_FILE"|head -n1)}"
 docker image inspect "livingruntime-knowledge:$OLD_KNOW" >/dev/null
 TMP_K="$(mktemp -d /tmp/eventgraph-graphiti.XXXXXXXX)"
 trap 'rm -rf "${TMP:-}" "$TMP_K"' EXIT
 echo "FROM livingruntime-knowledge:$OLD_KNOW" > "$TMP_K/Dockerfile"
 for path in "${know_files[@]}";do
  [[ -f "$path" ]] || continue
  printf 'COPY %s /app/%s\n' "$path" "${path#knowledge_service/}" >> "$TMP_K/Dockerfile"
 done
 docker build --network none --pull=false -q -f "$TMP_K/Dockerfile" -t "livingruntime-knowledge:$TAG" .
fi
# Pin only changed services, retaining existing image tags for untouched containers.
python3 - "$ENV_FILE" "$TAG" "$SHA" "$API" "$WORKER" "$WEB" "$KNOWLEDGE" "$SETUP" <<'PY'
import os, pathlib,sys
path=pathlib.Path(sys.argv[1])
tag,sha=sys.argv[2:4]
flags=list(map(int,sys.argv[4:]))
mapping={"LRSITE_RELEASE_API":flags[0],"LRSITE_RELEASE_WORKER":flags[1],"LRSITE_RELEASE_WEB":flags[2],
 "LRSITE_RELEASE_KNOWLEDGE":flags[3],"LRSITE_RELEASE_SETUP":flags[4]}
rows=path.read_text().splitlines()
cfg={x.split("=",1)[0]:x.split("=",1)[1] for x in rows if "=" in x and not x.startswith("#")}
for key,on in mapping.items():
 if on: cfg[key]=tag
cfg["LRSITE_DEPLOYED_SHA"]=sha
cfg["LRSITE_RELEASE"]=tag
out=[];seen=set()
for row in rows:
 k=row.split("=",1)[0]
 if k in cfg and "=" in row and not row.startswith("#"):out.append(k+"="+cfg[k]);seen.add(k)
 else:out.append(row)
for k in cfg:
 if k not in seen:out.append(k+"="+cfg[k])
path.write_text("\n".join(out)+"\n")
os.chmod(path,0o600)
PY
services=()
((SETUP))&&services+=(setup)
((API))&&services+=(api)
((WORKER))&&services+=(worker)
((WEB))&&services+=(web)
((KNOWLEDGE))&&services+=(knowledge)
if (("${#services[@]}"));then
 echo "Updating only: ${services[*]}"
 "${COMPOSE[@]}" up -d --no-build --pull never --no-deps "${services[@]}"
fi
python3 scripts/production-smoke.py
echo "SUCCESS incremental release $SHA"
