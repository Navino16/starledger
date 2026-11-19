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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
