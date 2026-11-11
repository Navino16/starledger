# Starledger

<p>
  <a href="https://github.com/Navino16/starledger/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Navino16/starledger/ci.yml?label=CI&style=flat-square" alt="CI"></a>
  <a href="https://codecov.io/gh/Navino16/starledger"><img src="https://img.shields.io/codecov/c/github/Navino16/starledger?style=flat-square&label=Coverage" alt="Coverage"></a>
</p>

Shared stats tracker for OGame: a Tampermonkey userscript collects data the player already sees in the game, and a self-hosted server stores and displays it.

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
- [Deployment guide](docs/deploy.md)
- [MVP design](docs/superpowers/specs/2026-11-11-mvp-client-sync-design.md)
- [Implementation plan](PLAN.md)

The tool must comply with [AGENTS.md](AGENTS.md) (OGame tool rules).
