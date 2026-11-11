# OGame Dashboard

A shared OGame stats tracker: a Tampermonkey userscript collects data the player already sees in the game, and a self-hosted server stores and displays it.

## Layout

- `packages/shared`: shared zod schemas and pure parsers
- `apps/server`: Fastify + PostgreSQL API
- `apps/userscript`: Tampermonkey userscript (Vite + vite-plugin-monkey)

## Commands

```sh
pnpm install
pnpm test        # Vitest, all packages
pnpm typecheck   # tsc, all packages
pnpm lint        # Biome
pnpm build
```

Requires Node 26 (`nvm use`) and pnpm 12 (`npm i -g pnpm@12`; pnpm then switches to the `packageManager` version).

## Documentation

- [Functional spec](docs/spec-fonctionnelles.md)
- [MVP design](docs/superpowers/specs/2026-11-11-mvp-client-sync-design.md)
- [Implementation plan](PLAN.md)

The tool must comply with [AGENTS.md](AGENTS.md) (OGame tool rules).
