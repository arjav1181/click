# Self-hosting Click

Click is built to run on your own machine or your own servers. You keep the
database, the audio, the transcripts and the API keys. There is no account to
create on someone else's service and nothing to pay for.

Two paths:

- **[Docker Compose](#docker-compose)** — the whole stack in one command.
  Recommended.
- **[Manual](#manual)** — run Postgres, Redis and the app yourself.

---

## Requirements

| path | needs |
| --- | --- |
| Docker Compose | Docker 24+ and Compose v2. ~6 GB RAM if you run the local ASR model. |
| Manual | Node.js 22+, pnpm 10+, PostgreSQL 16+ with `pgvector`, `citext` and `pg_trgm`, Redis 7 (optional) |

Nothing else is required. Click ships deterministic `mock` providers for speech
to text and notes, so a fresh install transcribes and summarises without any
API key. Add keys when you want better quality.

---

## Docker Compose

```bash
git clone https://github.com/arjav1181/click.git
cd click
cp .env.example .env
$EDITOR .env          # at minimum set APP_URL, APP_SECRET, ENCRYPTION_KEY
docker compose -f infra/compose/docker-compose.yml up -d
```

Open `http://localhost`.

The stack starts:

| service | what it is |
| --- | --- |
| `db` | PostgreSQL 17 with pgvector, with the schema applied by `migrate` |
| `redis` | BullMQ broker and job queue |
| `minio` | S3-compatible object storage for recordings |
| `migrate` | one-shot service that applies pending SQL migrations |
| `web` | the Next.js app |
| `worker` | the background worker (transcribe, summarize, embed, email) |
| `asr` | local faster-whisper speech-to-text service |
| `caddy` | reverse proxy and TLS terminator |

### Create the first user

There is no signup email flow until you configure SMTP, so use the CLI:

```bash
docker compose -f infra/compose/docker-compose.yml run --rm web \
  pnpm --filter @click/db cli create-admin you@example.com 'a-long-password'
```

Other operator commands:

```bash
pnpm --filter @click/db cli reset-password you@example.com 'new-password'
pnpm --filter @click/db cli verify-email you@example.com
pnpm --filter @click/db cli invite my-workspace someone@example.com member
```

### Seed the demo workspace (optional)

```bash
docker compose -f infra/compose/docker-compose.yml --profile tools run --rm seed
```

This creates `ava@click.local` with password `click-demo-2026`. Change it
before exposing the instance, or skip the seed entirely.

---

## Manual

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev          # web on :3000
pnpm worker       # background jobs, in a second terminal
```

Without `REDIS_URL`, jobs run inside the web process. That is fine for a
single-node install and removes the Redis requirement entirely.

---

## Configuration

Everything is an environment variable; [`.env.example`](../.env.example) lists
all of them with comments. The ones that matter most:

### Required

| variable | why |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `APP_URL` | public URL of the instance. Drives cookie `Secure`, the OIDC redirect URI and email links. |
| `APP_SECRET` | application secret. |
| `ENCRYPTION_KEY` | 32-byte key (base64 or hex) that encrypts stored provider and calendar secrets. Generate one with `openssl rand -base64 32`. **Changing it makes existing stored secrets unreadable.** |

### Speech to text

```ini
ASR_PROVIDER=mock      # no key, deterministic demo transcript
ASR_PROVIDER=local     # faster-whisper in the `asr` container
ASR_PROVIDER=openai    # any OpenAI-compatible /audio/transcriptions endpoint
ASR_URL=http://asr:8000
ASR_API_KEY=
ASR_MODEL=whisper-1
```

`local` needs no key and no network. It is slower than a hosted API but runs on
your hardware. The container downloads the model on first use; set
`ASR_MODEL=small` (default), `medium` or `large-v3` to trade speed for
accuracy, and `ASR_DEVICE=cuda` plus `ASR_COMPUTE_TYPE=float16` on a GPU host.

### Notes and chat

```ini
LLM_PROVIDER=mock      # deterministic extractive notes, no key
LLM_PROVIDER=openai    # OpenAI, Groq, Together, OpenRouter, Ollama, vLLM, LM Studio…
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

Any endpoint that speaks the OpenAI chat-completions protocol works, including
a local model server. This is the bring-your-own-key path: your key, your
data, your bill.

### Storage

```ini
STORAGE_DRIVER=local
STORAGE_DIR=.data/uploads
```

or

```ini
STORAGE_DRIVER=s3
S3_ENDPOINT=http://minio:9000     # or https://s3.eu-west-1.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=click
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true           # MinIO needs this; AWS does not
```

Cloudflare R2, Backblaze B2 and DigitalOcean Spaces all work with the S3
driver.

### Email

```ini
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false        # true for port 465
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Click <click@example.com>
```

Without SMTP, Click cannot send verification, reset or invitation emails, and
magic-link sign-in is unavailable. Use the CLI to bootstrap users instead.
In development, messages are written to `.data/mail` and the API returns a
`devLink` you can open directly.

### Single sign-on

```ini
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_DISPLAY_NAME=Google Workspace
OIDC_SCOPES=openid email profile
```

The redirect URI is `$APP_URL/api/v1/auth/oidc/callback`. Register that exact
URL with your provider. Click implements OIDC with authorization code + PKCE;
SAML is not implemented yet.

### Spend cap

```ini
BUDGET_CAP_USD=50
ASR_COST_PER_MINUTE=0.006
LLM_INPUT_COST_PER_1K=0.00015
LLM_OUTPUT_COST_PER_1K=0.0006
```

Click meters ASR seconds and LLM tokens per organization and refuses to spend
past the cap. The per-unit prices are **your estimates** — Click never bills
you and never sells usage. Set the prices to what your provider charges you so
the estimate is meaningful, or leave them at zero to only meter volume.

---

## Operating

### Health

`GET /api/healthz` reports database, queue, storage and email status. The
worker exposes its own `/healthz` on `WORKER_HEALTH_PORT` (8081 by default).
Both are wired into the Compose health checks.

### Backups

Back up two things: the database and the object storage.

```bash
# database
docker compose -f infra/compose/docker-compose.yml exec -T db \
  pg_dump -U click -Fc click > click-$(date +%F).dump

# recordings (MinIO)
docker compose -f infra/compose/docker-compose.yml run --rm minio-init \
  mc mirror local/click /backup/click
```

Restore with `pg_restore` and `mc mirror` in the other direction. The database
is the source of truth; audio is disposable if your retention policy allows.

### Upgrades

```bash
git pull
docker compose -f infra/compose/docker-compose.yml up -d
```

The `migrate` service applies pending SQL migrations before the new web and
worker containers start. Migrations are append-only: never edit an applied
migration, because the migrator refuses to run when a checksum changes.

### Retention

Each workspace has a retention policy (`retention_policies`): transcript days,
audio days and the recording mode (`audio`, `transcript_only` or `none`).
Transcript-only mode stores no audio at all. A scheduled purge job that
enforces the policy on a timer is not implemented yet — for now, delete
recordings manually or set audio retention to zero.

---

## Security notes

- Sessions are opaque random tokens; only a SHA-256 hash is stored. The cookie
  is `HttpOnly` and `SameSite=Lax`, and `Secure` when `APP_URL` starts with
  `https://`. Put Click behind TLS — Caddy does that for you if you give it a
  domain.
- Every tenant table has row-level security. A query for another workspace's
  id returns nothing, regardless of application bugs.
- Passwords use scrypt. There is no password reset by email unless SMTP is
  configured; the CLI always works.
- Put Caddy (or your proxy) in front of the app so TLS is terminated, and set
  `APP_URL` to the `https://` origin.
- Do not expose the Postgres or MinIO ports publicly. The Compose file binds
  MinIO's console to `127.0.0.1` for that reason.
- Report vulnerabilities privately — see [`SECURITY.md`](../SECURITY.md).

## Known gaps

See [`replica/backend.md`](../replica/backend.md) for the full list. The ones
that matter most for a self-hoster: SAML SSO, calendar sync, multi-workspace
switching, outgoing webhooks, an automatic retention purge, and Redis-backed
rate limiting (the current limiter is per process).
