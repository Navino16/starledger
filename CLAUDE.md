# Project instructions

@AGENTS.md

- Functional spec: `docs/spec-fonctionnelles.md`
- MVP design: `docs/superpowers/specs/2026-11-11-mvp-client-sync-design.md`

## Code comments
Exception to the usual "comments only for complex code or debated decisions" rule: AGENTS.md §0 requires commenting every compliance-relevant choice. Such comments are one line and cite the section, e.g. `// AGENTS.md §4: passive read, no game request`. Gray-area features use the exact marker from AGENTS.md §3.

## Codecov
Coverage: https://app.codecov.io/gh/Navino16/starledger. Query the API v2 with the read-only token from `~/.config/codecov/env` (never print it):
- Load: `set -a; . ~/.config/codecov/env; set +a` (exports `CODE_COVE_API_TOKEN`)
- Totals: `curl -fsS -H "Authorization: Bearer $CODE_COVE_API_TOKEN" "https://api.codecov.io/api/v2/github/Navino16/repos/starledger/totals/?branch=develop"`
- Per file: `.../repos/starledger/report/?branch=develop&path=<dir>`
- PR comparison: `.../repos/starledger/compare/?pullid=<n>`
