#!/usr/bin/env bash
# One-step rollback on VM09: point web/api/worker/knowledge back at images that are already loaded here.
# No build, no Git checkout change, no migration, PostgreSQL and Neo4j untouched.
#   bash scripts/rollback-prod.sh                 back to what ran before the last deploy-prod.sh release
#   bash scripts/rollback-prod.sh <app-tag> [<knowledge-tag>]
#   bash scripts/rollback-prod.sh --list          show the loaded image tags and the current/previous release
# Add --force to roll back across a migration that drops or renames something the older code may still use.
# Afterwards revert the bad change on main, or the next deploy-prod.sh will release it again.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml
 -f docker-compose.knowledge.yml -f docker-compose.release.yml --profile knowledge)
VALID='^[0-9a-f]{12}$'
read_tag() { sed -n "s/^$1=//p" .env | tail -n1; }

FORCE=0; LIST=0; ARGS=()
for a in "$@"; do
 case "$a" in
  --force) FORCE=1 ;;
  --list) LIST=1 ;;
  -*) echo "Usage: $0 [--list] [--force] [app-tag [knowledge-tag]]" >&2; exit 2 ;;
  *) ARGS+=("$a") ;;
 esac
done
test -f .env

CUR_APP="$(read_tag LRSITE_APP_RELEASE)"; CUR_APP="${CUR_APP:-$(read_tag LRSITE_RELEASE)}"
CUR_KNOWLEDGE="$(read_tag LRSITE_KNOWLEDGE_RELEASE)"; CUR_KNOWLEDGE="${CUR_KNOWLEDGE:-$CUR_APP}"
PREV_APP="$(read_tag LRSITE_PREVIOUS_APP_RELEASE)"
PREV_KNOWLEDGE="$(read_tag LRSITE_PREVIOUS_KNOWLEDGE_RELEASE)"

if [[ "$LIST" == 1 ]]; then
 echo "current  app=$CUR_APP knowledge=$CUR_KNOWLEDGE"
 echo "previous app=${PREV_APP:-none} knowledge=${PREV_KNOWLEDGE:-none}"
 docker image ls livingruntime-app --format '{{.Tag}}\t{{.CreatedSince}}'
 docker image ls livingruntime-knowledge --format 'knowledge {{.Tag}}\t{{.CreatedSince}}'
 exit 0
fi

if [[ ${#ARGS[@]} -eq 0 ]]; then
 [[ -n "$PREV_APP" ]] || { echo "No previous release recorded in .env; pass a tag (see --list)" >&2; exit 1; }
 APP="$PREV_APP"; KNOWLEDGE="${PREV_KNOWLEDGE:-$CUR_KNOWLEDGE}"
else
 APP="${ARGS[0]}"; KNOWLEDGE="${ARGS[1]:-$CUR_KNOWLEDGE}"
fi
for t in "$APP" "$KNOWLEDGE"; do [[ "$t" =~ $VALID ]] || { echo "Not a 12-character release tag: $t" >&2; exit 1; }; done
docker image inspect "livingruntime-app:$APP" >/dev/null 2>&1 || { echo "Image livingruntime-app:$APP is not loaded on this host" >&2; exit 1; }
docker image inspect "livingruntime-knowledge:$KNOWLEDGE" >/dev/null 2>&1 || { echo "Image livingruntime-knowledge:$KNOWLEDGE is not loaded on this host" >&2; exit 1; }
if [[ "$APP" == "$CUR_APP" && "$KNOWLEDGE" == "$CUR_KNOWLEDGE" ]]; then echo "Already running app=$APP knowledge=$KNOWLEDGE"; exit 0; fi

# The schema stays at the newest migration. Additive migrations are safe for older code; a drop or rename
# since the target release can break it, so that needs --force after reading the listed files.
if git cat-file -e "$APP^{commit}" 2>/dev/null; then
 mapfile -t NEWER < <(git diff --name-only --diff-filter=A "$APP" HEAD -- database/migrations 'modules/*/migrations')
 if [[ ${#NEWER[@]} -gt 0 ]]; then
  echo "Migrations applied since $APP (they stay applied):"; printf '  %s\n' "${NEWER[@]}"
  RISKY="$(grep -liE '\b(drop|rename)\b' "${NEWER[@]}" || true)"
  if [[ -n "$RISKY" && "$FORCE" != 1 ]]; then
   echo "These drop or rename something the older code may still read:" >&2; printf '  %s\n' $RISKY >&2
   echo "Check them, then re-run with --force, or fix forward instead." >&2
   exit 1
  fi
 fi
else
 echo "Commit $APP is not in this checkout; cannot check migrations since then." >&2
 [[ "$FORCE" == 1 ]] || { echo "Re-run with --force to roll back anyway." >&2; exit 1; }
fi

echo "[1/3] Pin app=$APP knowledge=$KNOWLEDGE (was app=$CUR_APP knowledge=$CUR_KNOWLEDGE)"
python3 - "$APP" "$KNOWLEDGE" "$CUR_APP" "$CUR_KNOWLEDGE" <<'WRITE_RELEASE'
from pathlib import Path
import os,re,sys
app,knowledge,cur_app,cur_knowledge=sys.argv[1:]
tags={"LRSITE_APP_RELEASE":app,"LRSITE_KNOWLEDGE_RELEASE":knowledge,"LRSITE_RELEASE":app}
# The release being replaced becomes the previous one, so running this again undoes the rollback.
if re.fullmatch(r"[0-9a-f]{12}",cur_app): tags["LRSITE_PREVIOUS_APP_RELEASE"]=cur_app
if re.fullmatch(r"[0-9a-f]{12}",cur_knowledge): tags["LRSITE_PREVIOUS_KNOWLEDGE_RELEASE"]=cur_knowledge
p=Path(".env")
data=p.read_text()
for key,tag in tags.items():
 if re.search(r"^"+key+r"=",data,re.M):
  data=re.sub(r"^"+key+r"=.*$",key+"="+tag,data,flags=re.M)
 else:data+="\n"+key+"="+tag+"\n"
p.write_text(data)
os.chmod(p,0o600)
WRITE_RELEASE
python3 scripts/production-env-check.py .env --role production --compare config/environments/production.flags.env.example --enforce
"${COMPOSE[@]}" config --quiet

echo "[2/3] Recreate only application services"
"${COMPOSE[@]}" up -d --no-deps --no-build --pull never api worker web knowledge

echo "[3/3] Verify real site content and graph"
for n in 1 2 3 4 5 6 7 8 9 10; do
 if python3 scripts/production-smoke.py; then
  echo "ROLLED BACK: app=$APP knowledge=$KNOWLEDGE. Now revert the bad change on main before the next deploy."
  exit 0
 fi
 sleep 6
done
echo "Smoke failed after rollback; volumes were not altered. Run it again with the other tag to return." >&2
exit 1
