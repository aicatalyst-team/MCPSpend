#!/usr/bin/env bash
# Daily Postgres backup → S3-compatible storage.
#
# Designed to run as a Coolify Scheduled Task (cron) on the VPS. The script
# pg_dumps the production DB inside the postgres container, gzips, and uploads
# to an S3 bucket via AWS CLI v2. Old backups (>30 days) are pruned.
#
# Required env vars (set in Coolify scheduled-task config):
#   POSTGRES_CONTAINER   - name of the prod postgres container (default: mcpspend-postgres)
#   POSTGRES_USER        - DB user (read from container env if unset)
#   POSTGRES_DB          - DB name (read from container env if unset)
#   S3_BUCKET            - destination bucket (e.g. mcpspend-backups)
#   S3_PREFIX            - optional prefix (default: postgres/)
#   AWS_ACCESS_KEY_ID    - S3 / Cloudflare R2 / Backblaze B2 access key
#   AWS_SECRET_ACCESS_KEY
#   AWS_ENDPOINT_URL     - optional, for non-AWS S3-compatible providers
#   AWS_REGION           - default: auto
#   RETENTION_DAYS       - default: 30
#
# Usage:
#   ./backup.sh

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mcpspend-postgres}"
S3_PREFIX="${S3_PREFIX:-postgres/}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
AWS_REGION="${AWS_REGION:-auto}"

if [ -z "${S3_BUCKET:-}" ]; then
  echo "[backup] S3_BUCKET not set — aborting" >&2
  exit 2
fi
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "[backup] AWS credentials not set — aborting" >&2
  exit 2
fi

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
TMPFILE="/tmp/mcpspend-${TS}.sql.gz"

# Resolve DB user/name from container env if not provided.
USER="${POSTGRES_USER:-$(docker exec "$POSTGRES_CONTAINER" sh -c 'echo "$POSTGRES_USER"')}"
DB="${POSTGRES_DB:-$(docker exec "$POSTGRES_CONTAINER" sh -c 'echo "$POSTGRES_DB"')}"

if [ -z "$USER" ] || [ -z "$DB" ]; then
  echo "[backup] cannot resolve POSTGRES_USER/DB from container $POSTGRES_CONTAINER" >&2
  exit 3
fi

echo "[backup] dumping $DB (user=$USER) → $TMPFILE"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$USER" -d "$DB" --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$TMPFILE"

SIZE=$(stat -c %s "$TMPFILE" 2>/dev/null || stat -f %z "$TMPFILE")
echo "[backup] dump size: $SIZE bytes"

# Upload. AWS_ENDPOINT_URL is read by aws-cli automatically when set.
S3_KEY="s3://${S3_BUCKET}/${S3_PREFIX}mcpspend-${TS}.sql.gz"
echo "[backup] uploading to $S3_KEY"

if command -v aws >/dev/null 2>&1; then
  AWS_REGION="$AWS_REGION" aws s3 cp "$TMPFILE" "$S3_KEY" --only-show-errors
else
  # Fall back to curl + minimal sigv4 if aws CLI isn't installed.
  echo "[backup] aws CLI not found, falling back to curl" >&2
  echo "[backup] please install aws-cli v2 for production use" >&2
  exit 4
fi

rm -f "$TMPFILE"
echo "[backup] uploaded successfully"

# Prune anything older than RETENTION_DAYS.
echo "[backup] pruning entries older than $RETENTION_DAYS days under $S3_PREFIX"
CUTOFF_ISO="$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
              date -u -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ)"

aws s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "$S3_PREFIX" \
  --query "Contents[?LastModified<'$CUTOFF_ISO'].Key" --output text 2>/dev/null \
  | tr '\t' '\n' | grep -v '^$' | while read -r key; do
    echo "[backup] deleting $key"
    aws s3 rm "s3://${S3_BUCKET}/${key}"
  done

echo "[backup] done."
