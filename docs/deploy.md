# Deployment guide

Starledger runs as two containers: the app (Fastify) and PostgreSQL 17, described by `compose.yaml`.

## Quick start

```sh
cp .env.example .env
openssl rand -hex 32     # paste into SESSION_SECRET
$EDITOR .env             # set POSTGRES_PASSWORD, SESSION_SECRET, PUBLIC_URL
docker compose up -d --build
curl -fsS http://127.0.0.1:3000/healthz   # {"ok":true}
```

Migrations run automatically each time the `app` container starts.

## Variables

Set in `.env`, read by `compose.yaml`.

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Password of the `starledger` database user. Use only URL-safe characters (e.g. `openssl rand -hex 16`), as it is embedded in `DATABASE_URL`. |
| `SESSION_SECRET` | yes | 64 hexadecimal characters, generated with `openssl rand -hex 32`. Changing it logs everyone out. |
| `PUBLIC_URL` | yes | Public HTTPS URL users reach the server at, without trailing path (e.g. `https://starledger.example.com`). |
| `OPEN_SIGNUP` | no | `true` lets anyone sign up; default `false` (invitations only). |
| `TRUST_PROXY` | no | Which proxies may set `X-Forwarded-For`. See below. |

`DATABASE_URL` and `PORT` are set by the compose file (the app listens on 3000 inside the container).

## First admin

```sh
docker compose exec app node dist/cli.js create-admin --username admin
```

The password is read from the terminal without echo. To script it, pipe it instead:
`printf '%s' "$PASSWORD" | docker compose exec -T app node dist/cli.js create-admin --username admin`.
Then sign in at `PUBLIC_URL/login` and generate an API key from the account page.

## Reverse proxy and HTTPS

Put a reverse proxy (Caddy, nginx, Traefik) in front of the app and terminate HTTPS there. `PUBLIC_URL` must be the HTTPS address users see. The proxy must forward `X-Forwarded-For` and `X-Forwarded-Proto`.

By default `compose.yaml` publishes the app on `127.0.0.1:3000` only, so a proxy on the same host reaches it and the Internet does not. For a proxy on another host or Docker network, change the `ports` entry (for example `192.168.1.10:3000:3000`, or drop it and attach the proxy to the compose network). Never publish it on `0.0.0.0` without a proxy in front.

## TRUST_PROXY

Controls which connections are trusted to report the real client IP through `X-Forwarded-For` (used by rate limiting). Default: `loopback,linklocal,uniquelocal`, so a proxy on the Docker network, the host or the LAN is recognised without configuration, while a public client connecting directly cannot forge the header.

| Value | Meaning |
|---|---|
| `loopback,linklocal,uniquelocal` | Default. Trust private and local addresses. |
| `true` | Trust every hop. Only safe if the app is reachable through the proxy alone. |
| `false` | Trust no proxy; the client IP is the socket address. |
| a number, e.g. `1` | Trust that many hops. Assumes the app is exposed only through the proxy. |
| `10.0.0.5,192.168.1.0/24` | Comma-separated IPs, CIDRs or the named ranges above. |

A client with a private address (LAN, another container) counts as a trusted hop under the default. If the LAN is not trusted, restrict the list to the proxy IP.

## Backup and restore

```sh
docker compose exec -T postgres pg_dump -U starledger starledger | gzip > starledger-$(date +%F).sql.gz
```

Restore into an empty database:

```sh
gunzip -c starledger-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U starledger starledger
```

The data lives in the `pgdata` volume; `docker compose down -v` deletes it.

## Updating

```sh
git pull
docker compose up -d --build
```
