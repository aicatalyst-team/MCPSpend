# MCPSpend ops

## Daily Postgres backup → S3

Designed to run as a **Coolify Scheduled Task** on the production VPS.

### One-time setup

1. **Pick an S3-compatible bucket.** Cheapest options:
   - **Cloudflare R2** — no egress fees, $0.015/GB-mo
   - **Backblaze B2** — $0.006/GB-mo + free first 10 GB
   - **AWS S3 Glacier Deep Archive** — $0.00099/GB-mo for restore-rarely
2. **Create access keys** for that bucket. Note the endpoint URL if not AWS.
3. **Install `aws` CLI v2** on the VPS:
   ```bash
   ssh vps "curl -sL 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o /tmp/awscli.zip \
     && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install"
   ```
4. **Set up Coolify Scheduled Task:**
   - Coolify UI → Servers → your VPS → Scheduled Tasks → New
   - Schedule: `0 3 * * *` (daily at 03:00 UTC)
   - Container: leave blank (runs on host)
   - Command: `bash /opt/mcpspend/backup.sh`
   - Env vars: paste the variables documented in [backup.sh](backup.sh) header
5. **Copy the script onto the VPS** (one-time):
   ```bash
   ssh vps "mkdir -p /opt/mcpspend"
   scp ops/backup.sh vps:/opt/mcpspend/backup.sh
   ssh vps "chmod +x /opt/mcpspend/backup.sh"
   ```

### Verify it works

```bash
ssh vps "bash /opt/mcpspend/backup.sh"
# expect: [backup] uploaded successfully
```

Then list what's in the bucket:

```bash
ssh vps "aws s3 ls s3://YOUR_BUCKET/postgres/"
```

### Restore (in an emergency)

```bash
# Pull the latest dump
ssh vps "aws s3 cp s3://YOUR_BUCKET/postgres/mcpspend-LATEST.sql.gz /tmp/restore.sql.gz"

# Restore into a fresh container or the current one (DESTRUCTIVE — script uses
# DROP TABLE IF EXISTS via --clean --if-exists so it overwrites whatever's there)
ssh vps "docker exec -i mcpspend-postgres sh -c 'gunzip | psql -U \$POSTGRES_USER -d \$POSTGRES_DB' < <(gunzip -c /tmp/restore.sql.gz)"
```
