# Self-host INFINITUM without Vercel

INFINITUM can run as a standalone Next.js Node.js service. Vercel is not required. The database and authentication remain in the configured Supabase project; the web application server can run on any host that supports Docker.

## Requirements

- Docker Engine and Docker Compose plugin.
- A Supabase project and an authorized account.
- The public Supabase URL and publishable key.
- Server-side secrets only when the enabled integrations require them.

## Configure

```bash
cp .env.example .env
```

Set at least:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Next.js embeds `NEXT_PUBLIC_*` values in the browser bundle at build time. If either public value changes, rebuild the image. These values are public by design; they are not substitutes for RLS or server-side authorization.

Add server-only variables from `.env.example` as needed. Never put `SUPABASE_SERVICE_ROLE_KEY`, OAuth client secrets, Composio keys or signing keys in a `NEXT_PUBLIC_*` variable.

## Build and start

```bash
docker compose up -d --build
docker compose logs -f infinitum
```

The application listens on port 3000 by default. Set `PORT=8080` in `.env` to expose it on port 8080.

## Update

```bash
git pull origin main
docker compose up -d --build
```

## Production reverse proxy

Terminate HTTPS at a reverse proxy or load balancer and forward requests to the container. Configure the public application URL and add that exact URL to the Supabase Auth redirect allowlist. OAuth providers must also allow the callback URL used by this installation.

## What remains external

- Supabase provides PostgreSQL, Auth, RLS, Storage and Realtime.
- WA.Auto/ZapFast and other explicitly configured integrations remain separate services.
- DataJud, DJEN and other tribunal sources remain external public services.
- Desktop releases are built separately by the Windows workflows.

A Docker image removes the Vercel runtime dependency; it does not provide free or unlimited compute. The host running Docker still supplies CPU, memory, storage and network access.
