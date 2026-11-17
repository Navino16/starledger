# MVP — client de collecte et synchronisation : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Workflow: one scope = one branch from `develop` = one PR to `develop` (skill `scoped-plan-execution`).

**Goal :** un userscript Tampermonkey qui collecte les rapports OGame et le carburant, les synchronise vers un serveur auto-hébergé multi-utilisateurs, et affiche un encart de stats partagées dans le jeu.

**Architecture :** monorepo pnpm en TypeScript.
- `packages/shared` contient les schémas d'observation (zod), les parseurs de messages et le calcul des stats. Ce code est pur et testé seul.
- `apps/server` (Fastify + PostgreSQL via Kysely) reçoit les observations brutes, les interprète avec `shared`, dédoublonne et sert les stats.
- `apps/userscript` (Vite + vite-plugin-monkey) lit passivement le DOM et les réponses AJAX, met les observations en file, les envoie et affiche l'encart.

**Tech Stack :**
- Node 26 (LTS), pnpm 12, TypeScript 7 (strict), Vitest 5, Biome 2
- Serveur : Fastify 5, Kysely + `pg`, PostgreSQL 17, zod 4, Eta (`@fastify/view`), `@fastify/secure-session`, `@fastify/csrf-protection`, `@fastify/formbody`, `@fastify/rate-limit`, `@node-rs/argon2`
- Userscript : vite-plugin-monkey, jsdom (tests)
- App web (scopes 23 et 24) : Vite, React, React Router, Tailwind CSS v4, Testing Library ; remplace Eta et `@fastify/view` au scope 24
- Dashboard (scope 26) : Recharts
- Tests base de données : `@testcontainers/postgresql`
- Docker Compose

**Spec :**
- Conception : `docs/superpowers/specs/2026-11-11-mvp-client-sync-design.md` (ci-après « design »). C'est la source de vérité, à lire avant toute tâche.
- Formats OGame : `docs/ogame-data-formats.md`. Non vérifiés, à confirmer au scope 10.
- Règles OGame : `AGENTS.md`. Contraintes dures.

## Avancement

| Scope | Sujet | Statut |
|---|---|---|
| 0 | Socle du dépôt et CI | ✅ |
| 1 | Shared : observations et parseurs de messages | ✅ |
| 2 | Shared : jours et calcul des stats | ✅ |
| 3 | Serveur : socle, utilisateurs, connexion web | ✅ |
| 4 | Serveur : invitations, clé API, réglages | ✅ |
| 5 | Serveur : API d'ingestion et de stats | ✅ |
| 6 | Docker et déploiement homelab | ✅ |
| 7 | Userscript : socle, file, options, consentement | ✅ |
| 8 | Userscript : collecte des messages | ✅ |
| 9 | Userscript : encart et détail | ✅ |
| 10 | Validation PTS : vraies captures, reparse, audit | ☐ |
| 11 | Carburant | ✅ |
| 12 | Transports entre joueurs | ✅ |
| 13 | Anomalies | ✅ |
| 14 | Dossier de tolérance et publication | ☐ |
| 15 | Renovate | ✅ (config ; installer l’app Renovate) |
| 16 | Détail façon OGLight | ✅ |
| 17 | Période personnalisée | ✅ |
| 18 | XP et artefacts des récompenses d'anomalie | ✅ |
| 19 | Surplus de lithium des récompenses | ✅ |
| 20 | Clés API multiples | ✅ |
| 21 | Mots de passe | ✅ |
| 22 | API JSON du site | ✅ |
| 23 | App web : socle et pages publiques | ✅ |
| 24 | Pages connectées et bascule | ✅ |
| 25 | API du dashboard | ✅ |
| 26 | Page Dashboard | ☐ |
| 27 | En-têtes de sécurité | ✅ |
| 28 | Icônes du jeu dans le dashboard | ☐ |

## Global Constraints

- **Aucune requête vers le serveur du jeu** depuis le userscript, ni appel `fetch`/XHR vers `*.ogame.gameforge.com`. Le script lit seulement le DOM et les événements jQuery globaux `ajaxSend`/`ajaxSuccess` déclenchés par le joueur (design §4.1, `AGENTS.md` §4).
- **Ne jamais remplacer une fonction du jeu** (contrairement à OGLight avec `submitFleet2`), ni modifier, retarder ou rejouer une requête (design §4.1).
- **Aucun minuteur dans le userscript** : pas de `setInterval`, pas de `setTimeout` différé, pas de backoff. Les envois vers notre serveur partent au chargement d'une page, après une collecte ou à l'ouverture du détail (design §4.1).
- **Consentement explicite** requis avant toute collecte et tout envoi (design §4.1, `AGENTS.md` §1.9).
- **Le `.user.js` n'est jamais minifié**, dépendances embarquées comprises (`build.minify: false`).
- **Monétisation intacte** : l'encart ne recouvre ni ne déplace Marchand, Officiers, Boutique, la barre de pub ou le footer, sur desktop comme sur mobile (`AGENTS.md` §1.7).
- Le masquage de l'encart OGLight porte exactement `// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3`.
- **Commentaires** : uniquement le code complexe, les décisions discutables et les choix de conformité, sur une ligne avec renvoi (`// AGENTS.md §4: passive read, no game request`). Voir `CLAUDE.md`.
- **Build et consommation de `@app/shared`** : `@app/shared` expose `"exports": { ".": "./src/index.ts" }` (consommé en source par Vitest, Vite et le bundler serveur ; jamais compilé seul). Le serveur est **bundlé avec tsdown** vers `apps/server/dist/{index,cli}.js` (ESM, cible node26), `@node-rs/argon2` et `pg` restant externes. Les imports relatifs restent sans extension.
- **Langues** : code, commits et documentation technique en anglais ; interface en français et en anglais. Messages de commit sur une seule ligne, sans co-author.
- **Inconnu ≠ 0** : toute valeur absente est `null` de bout en bout (parseur, base, API, affichage « ? »).
- **Isolation** : toute requête serveur est filtrée par l'utilisateur authentifié, sans exception.
- **Licences** : aucun code d'OGame Tracker copié. Code OGLight (MIT) uniquement avec attribution dans `THIRD_PARTY_NOTICES`. Jamais les noms « OGLight » ou « OGame Tracker » dans l'interface, sauf l'option « masquer l'encart OGLight ».
- **Valeurs par défaut de valorisation** (reprises d'OGLight) : MSU `3:2:1`, `expeditionShipRatio` 100, `ignoreExpeShipsLoss` false, `ignoreConsumption` false. Pour les échanges, `includeTradesInBalance` false.
- **Formule MSU** : `ceil(m + c·r0/r1 + d·r0/r2)`. OGLight utilise `d·r0`, ce qui revient au même quand r2 = 1.
- **Auto-audit** : la checklist de `AGENTS.md` §7 est déroulée et ses résultats sont notés dans la PR de chaque scope qui touche `apps/userscript`.
- **Dépendances** : avant chaque ajout, vérifier la dernière version avec `npx npm-check-updates --workspaces --root`. Exception assumée : `@types/node` suit la version majeure de Node (26). La politique `minimumReleaseAge` de pnpm 12 (versions publiées depuis moins de 24 h refusées) est respectée : on ne contourne jamais avec `minimumReleaseAgeExclude`.
- **Tests sur le PTS uniquement** (Singularity, en_808) tant que l'outil n'est pas toléré.

## Review Focus

1. **Observations du même message dans deux langues.** Les champs `name` de `technologiesgained` et `itemsgained` sont localisés. Un rapport lu sur un appareil en FR puis sur un appareil en EN doit être un **doublon**, pas un conflit. Le test est dans le scope 1, tâche 3 (les parseurs ne gardent aucun nom), et dans le scope 5, tâche 2.
2. **Attribut brut corrompu** : JSON invalide, timestamp absent ou type inconnu. Le message devient `unrecognized`, l'appli ne plante pas et ne produit aucun zéro inventé. Tests dans le scope 1, tâches 3 à 5.
3. **Navigation pendant un envoi.** OGame recharge la page entière. Les éléments de la file ne sont retirés qu'après l'accusé de réception. Un renvoi produit `duplicate` puis retire l'élément. Test dans le scope 7, tâche 3.
4. **Événement proche de minuit serveur lu depuis un navigateur dans un autre fuseau.** Le jour retenu est le même. Tests dans le scope 2, tâche 1 et le scope 8, tâche 1.
5. **Clé d'un utilisateur A qui demande les stats d'un compte de B.** La réponse est un résumé vide, sans aucune donnée de B. Test dans le scope 5, tâche 3.

---

## Interfaces partagées (référence pour toutes les tâches)

Elles sont définies dans les scopes 1 et 2 et réutilisées partout ailleurs.

```ts
// packages/shared/src/domain.ts
export type Resources = { metal: number; crystal: number; deuterium: number };
export type ShipCounts = Record<string, number>;               // shipId -> amount
export type Coords = { galaxy: number; system: number; position: number };
export type AccountRef = { serverId: number; lang: string; playerId: number; playerName: string | null };

// packages/shared/src/observation.ts (zod schemas + inferred types)
export const MAX_BATCH = 200;
export type MessageObservation = {
  kind: 'message'; clientObservationId: string /* uuid */; account: AccountRef;
  observedAt: number /* ms */; serverUtcOffsetMinutes: number /* -720..840 */;
  msgId: number; messageType: number | null; subtabId: number | null;
  raw: Record<string, string>;   // data-raw-* without prefix, lowercased key
};
export type FleetDispatchObservation = {
  kind: 'fleet_dispatch'; clientObservationId: string; account: AccountRef;
  observedAt: number; serverUtcOffsetMinutes: number;
  source: 'fleetdispatch' | 'minifleet'; mission: number;
  origin: Coords | null; target: Coords & { type: 1 | 2 | 3 };
  ships: ShipCounts; consumption: number | null; sentAt: number;
};
export type Observation = MessageObservation | FleetDispatchObservation;
export type ObservationBatch = { clientVersion: string; deviceId: string; observations: Observation[] };
export type AckStatus = 'accepted' | 'duplicate' | 'conflict' | 'unrecognized' | 'rejected';
export type BatchAck = { results: { clientObservationId: string; status: AckStatus; reason?: string }[] };

// packages/shared/src/events.ts
export type ParsedEvent = ExpeditionEvent | LifeformDiscoveryEvent | CombatEvent
  | ShortCombatEvent | RecyclingEvent | WreckfieldEvent | FuelEvent;
export type ParseResult =
  | { status: 'ok'; externalKey: string; occurredAt: number; event: ParsedEvent }
  | { status: 'unrecognized'; externalKey: string; occurredAt: number | null; reason: string };

// packages/shared/src/stats.ts
export type ValuationSettings = {
  msuRatio: [number, number, number]; expeditionShipRatio: number;
  ignoreExpeShipsLoss: boolean; ignoreConsumption: boolean; includeTradesInBalance: boolean;
};
export const DEFAULT_VALUATION: ValuationSettings;
export type StoredEvent = { day: string /* YYYY-MM-DD */; status: 'ok' | 'conflict'; event: ParsedEvent };
export function computeStats(events: StoredEvent[], settings: ValuationSettings): StatsSummary;

// packages/shared/src/api.ts (wire types shared by server and userscript, added in Task 5.3)
export type StatsPeriod = 'day' | 'week' | 'month' | 'all';
export type StatsResponse = {
  period: StatsPeriod; range: { from: string; to: string } | null; generatedAt: number;
  summary: StatsSummary; counts: { unrecognized: number }; settings: ValuationSettings;
};
export type ApiError = 'not_configured' | 'invalid_key' | 'unreachable' | 'client_outdated' | 'server_error';
```

`externalKey` : `msg:<msgId>` pour un message, `fuel:<clientObservationId>` pour un départ. Un départ n'est observé que par l'appareil qui l'envoie, donc l'UUID client suffit à le compter une seule fois. Le jeu ne renvoie aucun identifiant de flotte (`docs/ogame-data-formats.md` §6.3).

---

## Scope 0 — Socle du dépôt

Branche : `feature/repo-bootstrap`. **Avant de commencer** : créer `develop` depuis `main` (`git checkout -b develop && git checkout -b feature/repo-bootstrap`). Le dépôt n'a pas encore de remote GitHub : on travaille en local et on crée la PR quand l'utilisateur aura ajouté le remote.

### Tâche 0.1 : Monorepo, outillage et test témoin

**Files :**
- Create : `package.json` (privé, `packageManager: pnpm@12.x`, scripts `test`, `lint`, `typecheck`, `build`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, ES2023, moduleResolution bundler), `biome.json`, `vitest.config.ts` (`test.projects` : Vitest 5 n'a plus de fichier workspace), `.gitignore`, `.editorconfig`, `.nvmrc` (`26`), `LICENSE` (MIT, 2026, auteur du dépôt), `README.md` (but, structure, commandes)
- Create : `packages/shared/{package.json,tsconfig.json,src/index.ts}`, `apps/server/{package.json,tsconfig.json,src/index.ts}`, `apps/userscript/{package.json,tsconfig.json,src/main.ts}`
- Test : `packages/shared/test/smoke.test.ts`

- [x] **Step 1 : installer pnpm.** Node 26 n'embarque plus corepack : `nvm use && npm i -g pnpm@12`. pnpm bascule ensuite tout seul sur la version de `packageManager`. Vérifier : `pnpm -v` affiche `12.x`.
- [x] **Step 2 : écrire le test témoin.** `expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)`, avec `export const VERSION = '0.1.0'` dans `packages/shared/src/index.ts`.
- [x] **Step 3 : lancer les vérifications.** `pnpm install && pnpm test && pnpm typecheck && pnpm lint`. Attendu : tout PASS.
- [x] **Step 4 : commit.** `git commit -m "Bootstrap pnpm monorepo with shared, server and userscript packages"`

### Tâche 0.2 : Intégration continue GitHub Actions

**Files :**
- Create : `.github/workflows/ci.yml`
- Create : `.ncurc.json` (`{"cooldown": "1d"}`, déjà fait par le contrôleur, à commiter avec la tâche)

Workflow `ci.yml` :
- déclencheurs : `push` sur `main` et `develop`, et `pull_request` ;
- `permissions: contents: read` au niveau du workflow ;
- `concurrency` par ref, avec `cancel-in-progress: true` ;
- un job `check` sur `ubuntu-latest` :
  1. checkout ;
  2. installation de pnpm (`pnpm/action-setup`, version lue dans `packageManager`, pas de version en dur) ;
  3. installation de Node (`actions/setup-node`, `node-version-file: .nvmrc`, cache pnpm) ;
  4. `pnpm install --frozen-lockfile`, puis `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Chaque action est **épinglée sur un SHA de commit** avec la version en commentaire (`uses: actions/checkout@<sha> # v5.x.y`), à la dernière release publiée depuis plus de 24 h (vérifiée via `gh api repos/<owner>/<repo>/releases/latest`).

- [x] **Step 1 : écrire le workflow.**
- [x] **Step 2 : le valider en local.** `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color`. Attendu : aucune erreur.
- [x] **Step 3 : simuler les commandes du job en local**, dans l'ordre et sur une copie propre : `rm -rf node_modules && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Attendu : tout PASS.
- [x] **Step 4 : commit.** `git commit -m "Add GitHub Actions CI workflow"`
- [x] **Step 5 :** remplacé par les tâches 0.3 (alignement sur la convention CI des projets perso) et 0.4 (vérification sur GitHub).

### Tâche 0.3 : Alignement sur la convention CI des projets perso, couverture

Convention reprise de `budget` et `librarr`, avec les ajustements validés par l'utilisateur le 2026-11-11 : épinglage par SHA, Node lu dans `.nvmrc`, `timeout-minutes`, `persist-credentials: false`.

**Files :**
- Modify : `.github/workflows/ci.yml`, `package.json` (script `test:coverage`, devDependency `@vitest/coverage-v8`), `vitest.config.ts`, `.gitignore` (`.reports/`)

Workflow `ci.yml` :
- déclencheur : `pull_request` sur `[main, develop]` uniquement, sans `push` ;
- `concurrency: { group: ci-${{ github.event.pull_request.number || github.ref }}, cancel-in-progress: true }` ;
- `permissions: contents: read` ;
- quatre jobs parallèles, dont les noms servent de checks obligatoires : `Lint`, `Typecheck`, `Build`, `Test (unit + coverage)` ;
- pour chaque job : `runs-on: ubuntu-26.04` et `timeout-minutes: 15`, puis les étapes suivantes :
  1. checkout avec `persist-credentials: false` ;
  2. `pnpm/action-setup` sans version ;
  3. `actions/setup-node` avec `node-version-file: .nvmrc` et `cache: pnpm` ;
  4. `pnpm install --frozen-lockfile`, puis la commande du job (`pnpm lint`, `pnpm typecheck`, `pnpm build` ou `pnpm test:coverage`).
- Le job Test ajoute deux envois `codecov/codecov-action` (épinglé par SHA, dernière release publiée depuis plus de 24 h), tous deux avec `token: ${{ secrets.CODECOV_TOKEN }}` et `fail_ci_if_error: false` :
  - la couverture : `files: .reports/coverage/cobertura-coverage.xml` ;
  - les résultats de tests : `if: ${{ !cancelled() }}`, `files: .reports/junit.xml`, `report_type: test_results`.

Couverture :
- `test:coverage` lance `vitest run --coverage` à la racine, sur tous les projets ;
- provider `v8`, reporters `text` et `cobertura` vers `.reports/coverage/` ;
- reporters de test `default` et `junit` (`outputFile.junit: .reports/junit.xml`) ;
- pas de seuil bloquant.

- [x] **Step 1 : vérifier les versions** avec `npx npm-check-updates`. `@vitest/coverage-v8` doit avoir la même version majeure que `vitest`.
- [x] **Step 2 : écrire la config et le workflow.**
- [x] **Step 3 : valider.** Lancer actionlint (Docker) : zéro erreur. Lancer `pnpm test:coverage` : les fichiers `.reports/coverage/cobertura-coverage.xml` et `.reports/junit.xml` existent. Puis `pnpm lint && pnpm typecheck && pnpm build`.
- [x] **Step 4 : commit.** `git commit -m "Align CI with personal projects convention and add coverage"`

### Tâche 0.4 : Mise en service sur GitHub (après création du remote)

- [x] L'utilisateur crée le dépôt, le secret `CODECOV_TOKEN` et un token d'API Codecov en lecture, exporté en `CODECOV_API_TOKEN` dans son shell.
- [x] Badge Codecov dans le README : `https://img.shields.io/codecov/c/github/Navino16/<repo>?style=flat-square&label=Coverage`, avec un lien vers `https://codecov.io/gh/Navino16/<repo>`.
- [x] Section « Codecov » dans le `CLAUDE.md` du projet : URL du projet et requêtes `curl` vers l'API v2 avec `$CODECOV_API_TOKEN` (totaux, couverture par fichier, comparaison de PR). Pas de serveur MCP Codecov : aucun n'est officiel.
- [x] Ruleset de branche « Main/Develop », copié sur `budget` : merge squash uniquement, historique linéaire, checks obligatoires `Lint`, `Typecheck`, `Build`, `Test (unit + coverage)` et `CodeQL` (configuration par défaut activée), et blocage sur les alertes CodeQL.
- [ ] **Réactiver CodeQL dans le ruleset** (check obligatoire `CodeQL`, `integration_id` 57789, et règle `code_scanning` : alertes ≥ errors, alertes de sécurité ≥ high) après le premier merge `develop` → `main`. Tant que `main` ne contient que de la documentation, CodeQL ne détecte aucun langage et ne produit jamais de check. Il est donc retiré temporairement du ruleset (2026-11-11, décision de l'utilisateur). Modèle complet : `gh api repos/Navino16/bilan/rulesets/25401979`.
- [ ] Vérifier que la CI passe sur la PR du scope 0.

---

## Scope 1 — Shared : observations et parseurs de messages

Branche : `feature/shared-parsers`. Référence des formats : `docs/ogame-data-formats.md` §2 à §4.

### Tâche 1.1 : Types du domaine et schémas d'observation

**Files :**
- Create : `packages/shared/src/domain.ts`, `packages/shared/src/observation.ts`, `packages/shared/src/coords.ts`
- Test : `packages/shared/test/observation.test.ts`, `packages/shared/test/coords.test.ts`

**Interfaces :**
- Produit : les types de la section « Interfaces partagées », plus `observationBatchSchema` et `observationSchema` (zod), `parseCoords(s: string): Coords | null`, `isExpeditionPosition(c: Coords): boolean` (position 16).

- [x] **Step 1 : tests.**
  - `parseCoords('4:120:8')` vaut `{galaxy:4,system:120,position:8}` ; `parseCoords('[4:120:8]')` donne le même résultat ; `parseCoords('x')` et `parseCoords('1:2')` valent `null`.
  - Le schéma de lot rejette :
    - plus de `MAX_BATCH` observations ;
    - un `clientObservationId` qui n'est pas un UUID ;
    - `serverUtcOffsetMinutes` égal à 900 ;
    - un `raw` de plus de 64 clés ou une valeur de plus de 64 000 caractères ;
    - une `consumption` négative.
  - Le schéma accepte une observation `message` minimale, et une `fleet_dispatch` avec `consumption: null`.
- [x] **Step 2 : lancer.** `pnpm --filter @app/shared test`. Attendu : FAIL (modules absents).
- [x] **Step 3 : implémenter** les schémas zod (types inférés exportés) et `parseCoords`.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add domain types and observation schemas"`

### Tâche 1.2 : Fixtures synthétiques et données des vaisseaux

**Files :**
- Create : `packages/shared/src/ships.ts` (`SHIP_COSTS: Record<string, Resources>`, tableau de `docs/ogame-data-formats.md` §4 ; sonde 210 = `{metal:0,crystal:1000,deuterium:0}`) et `PROBE_ID = '210'`
- Create : `packages/shared/test/fixtures/messages/*.json`. Chaque fichier contient `{ "synthetic": true, "observation": MessageObservation, "expected": ParseResult }`. Fixtures à créer :
  - `expedition-resources`, `expedition-darkmatter`, `expedition-ships`, `expedition-nothing`, `expedition-blackhole`, `expedition-early`, `expedition-late`, `expedition-pirates`, `expedition-item` ;
  - `discovery-artifacts`, `discovery-xp` ;
  - `combat-attack-won`, `combat-defense-lost`, `combat-expedition-pos16`, `combat-probe-only` ;
  - `combat-short-probes`, `combat-short-ships` ;
  - `recycling`, `recycling-pos16` ;
  - `wreckfield`.

  Les valeurs brutes suivent exactement les formes du §3 du doc de formats, y compris les champs `name` localisés dans `technologiesgained` et `itemsgained`.
- Test : `packages/shared/test/fixtures.test.ts`

- [x] **Step 1 : test.** Chaque fixture passe `observationSchema.parse`, et `synthetic === true`.
- [x] **Step 2 : écrire les fixtures et `ships.ts`**, puis lancer le test. Attendu : PASS.
- [x] **Step 3 : commit.** `git commit -m "Add ship costs and synthetic message fixtures"`

### Tâche 1.3 : Parseurs expédition et découverte FdV

**Files :**
- Create : `packages/shared/src/events.ts` (types d'événements), `packages/shared/src/parsers/raw.ts`, `packages/shared/src/parsers/expedition.ts`, `packages/shared/src/parsers/lifeform.ts`
- Test : `packages/shared/test/parsers/expedition.test.ts`, `packages/shared/test/parsers/lifeform.test.ts`

**Interfaces :**
- Produit :
  - `rawJson<T>(raw, key, schema): T | null | 'invalid'`, `rawInt(raw, key): number | null | 'invalid'` ;
  - `parseExpedition(obs): ParseResult`, `parseLifeformDiscovery(obs): ParseResult` ;
  - `ExpeditionEvent` : `{kind:'expedition', coords, result, size, depletion, resources, darkMatter, shipsFound, shipsLost, itemId, lifeform, lifeformXp, artifacts}` ;
  - `ExpeditionResult` : `'resources'|'darkmatter'|'nothing'|'ships'|'trader'|'item'|'blackhole'|'early'|'late'|'pirates'|'aliens'` ;
  - `size` et `depletion` : l'entier brut du jeu ou `null`. Une valeur inconnue est gardée telle quelle ; les libellés sont exportés à part (`EXPEDITION_SIZES` : 2 = small, 1 = medium et 0 = large) et appliqués à l'affichage ;
  - `LifeformDiscoveryEvent` : `{kind:'lifeform_discovery', coords, result:'none'|'artifacts'|'lifeform_xp'|'ship_lost'|'lifeform_found', lifeform, xp, artifacts, artifactsSize: string|null}`. Aucun vaisseau de flotte n'est engagé dans une découverte : pas de `shipsLost` (`ship_lost` est seulement une issue). `artifactsSize` garde la chaîne brute du jeu (`ARTIFACT_SIZES` liste les valeurs connues).

- [x] **Step 1 : tests, pilotés par les fixtures.** Chaque fixture vérifie `toEqual(expected)`. Cas supplémentaires :
  - `resourcesgained` en JSON invalide : `unrecognized`, avec une `reason` qui contient `resourcesgained`.
  - `timestamp` absent : `unrecognized`, avec `occurredAt: null`.
  - `expeditionresult` vaut `'foo'` : `unrecognized`.
  - `occurredAt` vaut `timestamp × 1000`.
  - Aucun champ `name` ne se retrouve dans l'événement : deux observations qui ne diffèrent que par `technologiesgained[*].name` produisent des événements `toEqual`.
  - Navigation : multiplicateur < 1 → `early` ; multiplicateur > 1 ou `returnTimeAbsoluteIncreaseHours` > 0 → `late` (règle d'OGLight).
  - Découverte FdV sans `discoverytype` : le type est déduit (`artifactsfound` > 0 → artifacts, xp > 0 → lifeform_xp, sinon none).
  - Une ressource absente de `resourcesgained` vaut 0 dans `resources`. Elle est connue : l'expédition n'a rien rapporté de ce type.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.** Valider le JSON brut avec des schémas zod ; un échec rend `unrecognized` avec le nom de l'attribut.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add expedition and lifeform discovery parsers"`

### Tâche 1.4 : Parseurs combat (25) et combat en un round (48)

**Files :**
- Create : `packages/shared/src/parsers/combat.ts`
- Test : `packages/shared/test/parsers/combat.test.ts`

**Interfaces :**
- Produit :
  - `parseCombat(obs): ParseResult` et `parseShortCombat(obs): ParseResult` ;
  - `CombatEvent` : `{kind:'combat', coords, isExpedition, isProbeOnly, ownSide:'attacker'|'defender', ownPlanetDefended, outcome:'won'|'lost'|'draw', loot: Resources, lootSign: 1|-1|0, debrisCreated: Resources, shipsLost: ShipCounts}` ;
  - `ShortCombatEvent` : `{kind:'combat_short', coords, isExpedition, isProbeOnly, shipsLost}`.

- [x] **Step 1 : tests sur les fixtures**, plus les règles suivantes :
  - **Notre camp** : les entrées de `fleets` dont `player.id === obs.account.playerId`.
  - **`lootSign`** : +1 si on attaque et qu'on gagne ; −1 si `defenderspaceobject.owner.id` est le nôtre et que l'attaquant gagne ; 0 sinon, et toujours 0 en position 16.
  - **`shipsLost`** : somme des `destroyedTotal` du dernier round sur nos `fleetId`, moins `repairedTechnologies` quand on défend notre planète. Dans un `result` présent, `loot`, `debris` ou `repairedTechnologies` absents valent une liste vide (à vérifier sur le PTS au scope 10). Seuls les ids ≥ 200 et < 300 sont gardés (les défenses ne sont pas des vaisseaux).
  - **`debrisCreated`** : à partir de `result.debris.resources[].total`.
  - **`isProbeOnly`** : toutes les flottes attaquantes n'ont que la technologie 210.
  - **Combat en un round (48)** : `isProbeOnly` si `shipslost` n'a que la clé 210.
  - **Aucun de nos camps trouvé** (joueur absent de `fleets` et pas propriétaire du défenseur) : `unrecognized`, avec `reason: 'own side not found'`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add combat report parsers"`

### Tâche 1.5 : Recyclage, champ d'épaves et routeur de messages

**Files :**
- Create : `packages/shared/src/parsers/recycling.ts`, `packages/shared/src/parsers/wreckfield.ts`, `packages/shared/src/parsers/index.ts`
- Test : `packages/shared/test/parsers/router.test.ts`

**Interfaces :**
- Produit :
  - `parseMessage(obs: MessageObservation): ParseResult` ;
  - `PARSER_VERSION = 1` ;
  - `TRACKED_MESSAGE_TYPES = [25, 32, 33, 34, 41, 48, 54, 61]`. Les types 33 et 34 n'ont pas encore de parseur et ressortent `unrecognized` en gardant le brut, pour être réinterprétés au scope 12 ;
  - `RecyclingEvent` : `{kind:'recycling', coords, isExpedition, resources}` ;
  - `WreckfieldEvent` : `{kind:'wreckfield', coords, shipsRecovered}`.

- [x] **Step 1 : tests.**
  - Le routeur dirige 41, 61, 25, 48, 32 et 54 vers le bon parseur (fixtures).
  - Les types 33, 34, 99 et `null` donnent `unrecognized`, avec une `reason` qui contient `unsupported message type`.
  - Recyclage : les coordonnées viennent de `targetcoordinates`, sinon de `coords`. `deuterium` absent de `recycledresources` vaut 0. `isExpedition` est vrai en position 16.
  - L'`externalKey` vaut toujours `msg:<msgId>`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add recycling and wreckfield parsers and message router"`

### Tâche 1.6 : Événement carburant

**Files :**
- Create : `packages/shared/src/parsers/fuel.ts`
- Test : `packages/shared/test/parsers/fuel.test.ts`

**Interfaces :**
- Produit :
  - `parseFleetDispatch(obs: FleetDispatchObservation): ParseResult` ;
  - `FuelEvent` : `{kind:'fuel', source, mission, origin, target, ships, consumption: number | null}` ;
  - `externalKey` vaut `fuel:<clientObservationId>` et `occurredAt` vaut `sentAt`.

- [x] **Step 1 : tests.** `consumption` 1234.7 devient 1234 (troncature, comme OGLight). `consumption: null` reste `null`. `externalKey` et `occurredAt` ont les valeurs attendues.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add fleet dispatch fuel event parser"`

---

## Scope 2 — Shared : jours et calcul des stats

Branche : `feature/shared-stats`.

### Tâche 2.1 : Clés de jour et périodes

**Files :**
- Create : `packages/shared/src/time.ts`
- Test : `packages/shared/test/time.test.ts`

**Interfaces :**
- Produit :
  - `dayKey(epochMs: number, serverUtcOffsetMinutes: number): string` (`YYYY-MM-DD`, avec zéros) ;
  - `computeServerUtcOffsetMinutes(serverTimeMs: number, nowMs: number, browserUtcOffsetMinutes: number): number` : `(serverTime − now)` arrondi au quart d'heure, plus le décalage du navigateur ;
  - `periodRange(period: 'day'|'week'|'month'|'all', today: string): { from: string; to: string } | null` : semaine du lundi au dimanche, `all` vaut `null`.

- [x] **Step 1 : tests.**
  - `dayKey(Date.UTC(2026,10,10,23,30), 60)` vaut `'2026-11-11'`, et `dayKey(…, 0)` vaut `'2026-11-10'`.
  - `computeServerUtcOffsetMinutes` : un navigateur à UTC−5 (−300) devant un serveur à UTC+1, avec un écart d'horloge de +6 h ± 40 s, donne 60.
  - `periodRange('week','2026-11-11')` (un mercredi) vaut `{from:'2026-11-09',to:'2026-11-15'}`.
  - `periodRange('month','2026-02-10')` va jusqu'au `2026-02-28`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter**, sans dépendance de date externe.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add server-day keys and period ranges"`

### Tâche 2.2 : Calcul des stats

**Files :**
- Create : `packages/shared/src/stats.ts`
- Test : `packages/shared/test/stats.test.ts`

**Interfaces :**
- Produit : `ValuationSettings`, `DEFAULT_VALUATION`, `StoredEvent`, `computeStats` et `StatsSummary` :

```ts
type StatsSummary = {
  tiles: { metal: number; crystal: number; deuterium: number; darkMatter: number; artefacts: number; msu: number };
  fuel: { recorded: number; departures: number; unknownCount: number };
  expeditions: { count: number; outcomes: Record<ExpeditionResult, number>; resources: Resources;
                 darkMatter: number; shipsFound: ShipCounts; shipsLost: ShipCounts };
  combats: { count: number; won: number; lost: number; draw: number; lootSigned: Resources;
             shipsLost: ShipCounts; debrisCreated: Resources; probeOnly: number };
  recycling: { count: number; resources: Resources };
  discoveries: { count: number; outcomes: Record<LifeformDiscoveryEvent['result'], number>;
                 xpByLifeform: Record<string, number>; artefacts: number };
  wreckfields: { count: number; shipsRecovered: ShipCounts };
  conflictCount: number;
  // added in scope 2 review: valued gains/losses per category (all ≥ 0), tiles = Σ(gains − losses)
  balance: Record<'expeditions'|'combats'|'recycling'|'wreckfields'|'fuel', { gains: Resources; losses: Resources }>;
};
// also added: combats.shipsLost = non-expedition fights, combats.expeditionShipsLost = isExpedition fights
```

Règles des tuiles (design §5.6), à implémenter exactement :
- **métal, cristal, deut** :
  - ressources d'expédition, plus tous les recyclages ;
  - plus `loot × lootSign` des combats (25) ;
  - plus les vaisseaux trouvés en expédition × coût × `expeditionShipRatio`/100 ;
  - plus les vaisseaux des champs d'épaves × coût ;
  - moins les pertes de vaisseaux × coût, pour les combats 25 et 48, sondes seules comprises, et les `shipsLost` des expéditions. Les pertes « expédition » (expéditions, combats avec `isExpedition`) sont ignorées si `ignoreExpeShipsLoss` ;
  - moins le carburant enregistré sur le deut, sauf si `ignoreConsumption`.
- **AM** : AM des expéditions.
- **artefacts** : `artifacts` des expéditions et des découvertes.
- **MSU** : `ceil(m + c·r0/r1 + d·r0/r2)`.
- **Jamais comptés** : les débris créés par un combat.
- Les événements en `conflict` sont comptés avec leur premier état et incrémentent `conflictCount`.

- [x] **Step 1 : tests**, chacun sur une liste d'événements construite à la main :
  - une expédition de 1000 métal donne `tiles.metal` 1000 et `msu` 1000 ;
  - deux expéditions de 1000 métal donnent 2000. Deux événements distincts aux gains identiques comptent chacun ;
  - 3 petits transporteurs (202) trouvés avec un ratio de 50 % donnent métal +3000 et cristal +3000 ;
  - 2 sondes perdues dans un combat `isProbeOnly` donnent cristal −2000 ;
  - un combat perdu en défense avec 500 métal de butin donne métal −500 ;
  - un combat gagné avec 10 000 métal de débris créés laisse `tiles.metal` inchangé, et `combats.debrisCreated.metal` vaut 10 000 ;
  - un carburant de 300 donne deut −300 ; avec `ignoreConsumption`, il donne 0 ;
  - un carburant `consumption: null` donne `fuel.unknownCount` 1 et `fuel.recorded` 0 ;
  - avec `msuRatio [3,2,1]`, m=0, c=200 et d=100 donnent un MSU de 600 ;
  - une liste vide donne toutes les valeurs à 0 et `conflictCount` à 0.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter** une fonction pure, sans mutation des entrées.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add stats computation with OGLight-equivalent valuation"`

---

## Scope 3 — Serveur : socle, utilisateurs, connexion web

Branche : `feature/server-foundation`.

### Tâche 3.1 : Config, base, migrations et harnais de test

**Files :**
- Create :
  - `apps/server/src/config.ts` : `loadConfig(env): Config`, validé par zod. Variables :
    - `DATABASE_URL` ;
    - `SESSION_SECRET`, 64 caractères hexadécimaux ;
    - `PORT`, 3000 par défaut ;
    - `PUBLIC_URL` ;
    - `TRUST_PROXY`, `loopback,linklocal,uniquelocal` par défaut (revue du scope 3 ; accepte aussi `true`, `false`, un nombre de sauts ou une liste d'IP/CIDR) ;
    - `OPEN_SIGNUP`, `false` par défaut.
  - `apps/server/src/db/{db.ts,schema.ts,migrate.ts}` et `apps/server/src/db/migrations/0001_init.ts`.
- Test : `apps/server/test/helpers/db.ts` (un conteneur PostgreSQL 17 par fichier de test via testcontainers, puis les migrations), `apps/server/test/config.test.ts`, `apps/server/test/migrations.test.ts`

Tables de la migration 0001 (design §6.3), toutes avec `created_at timestamptz default now()` :
- `users(id uuid pk, username text unique /* lowercased */, password_hash text, is_admin bool default false, locale text check in ('fr','en') default 'en')`
- `invitations(id uuid pk, token_hash text unique, created_by uuid fk users, expires_at timestamptz, used_at timestamptz null, used_by uuid null fk users)`
- `api_keys(id uuid pk, user_id uuid fk, key_hash text unique, key_prefix text, revoked_at timestamptz null)`, avec un index unique partiel `(user_id) where revoked_at is null`
- `accounts(id bigserial pk, user_id uuid fk, server_id int, lang text, player_id bigint, player_name text null, unique(user_id, server_id, lang, player_id))`
- `devices(user_id uuid fk, device_id uuid, client_version text, first_seen timestamptz, last_seen timestamptz, pk(user_id, device_id))`
- `observations(id bigserial pk, user_id uuid fk, account_id bigint fk, device_id uuid, client_observation_id uuid, kind text, external_key text, payload jsonb, observed_at timestamptz, received_at timestamptz default now(), unique(user_id, client_observation_id))`
- `events(id bigserial pk, account_id bigint fk, external_key text, kind text null, status text check in ('ok','unrecognized','conflict'), occurred_at timestamptz null, day date null, data jsonb null, parser_version int, first_observation_id bigint fk observations, unique(account_id, external_key))`, avec un index `(account_id, day)`
- `universe_settings(user_id uuid fk, server_id int, lang text, msu_metal numeric default 3, msu_crystal numeric default 2, msu_deuterium numeric default 1, expedition_ship_ratio int default 100, ignore_expe_ships_loss bool default false, ignore_consumption bool default false, include_trades_in_balance bool default false, pk(user_id, server_id, lang))`

- [x] **Step 0 : outillage serveur.** Ajouter le build tsdown du serveur (`pnpm --filter @app/server build` produit `dist/index.js` et `dist/cli.js`), `"types": ["node"]` dans `apps/server/tsconfig.json`, le champ `exports` de `@app/shared`, et `timeout-minutes: 15` sur le job CI (téléchargement des images testcontainers).
- [x] **Step 1 : tests.** `loadConfig` rejette un `SESSION_SECRET` trop court et applique les valeurs par défaut. Après migration, les 8 tables existent, et une deuxième clé API active pour le même utilisateur viole l'index partiel.
- [x] **Step 2 : lancer.** `pnpm --filter @app/server test`. Attendu : FAIL. Docker doit tourner.
- [x] **Step 3 : implémenter** avec le `Migrator` de Kysely et un `FileMigrationProvider`.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add server config, database schema and migrations"`

### Tâche 3.2 : Utilisateurs et CLI admin

**Files :**
- Create : `apps/server/src/users/users.ts`, `apps/server/src/cli.ts`
- Test : `apps/server/test/users.test.ts`

**Interfaces :**
- Produit :
  - `createUser(db, {username, password, isAdmin, locale}): Promise<User>` : refuse un nom déjà pris, insensible à la casse, ou un mot de passe de moins de 12 caractères ;
  - `verifyCredentials(db, username, password): Promise<User | null>` ;
  - CLI `node dist/cli.js create-admin --username <name>` : le mot de passe est lu sur stdin et n'est jamais passé en argument ;
  - CLI `node dist/cli.js migrate`.

- [x] **Step 1 : tests.** Création puis vérification correcte ; mauvais mot de passe → `null` ; doublon `Alice`/`alice` refusé ; le hash commence par `$argon2id$`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter** avec `@node-rs/argon2` (paramètres par défaut).
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add user accounts and admin CLI"`

### Tâche 3.3 : Application Fastify, i18n et connexion web

**Files :**
- Create :
  - `apps/server/src/app.ts` : `buildApp(config, db): FastifyInstance`, avec `trustProxy` ;
  - `apps/server/src/web/{auth.ts,i18n.ts,routes-auth.ts}` ;
  - `apps/server/src/web/views/{layout.eta,login.eta}` ;
  - `apps/server/src/web/locales/{fr.json,en.json}` ;
  - `apps/server/src/index.ts` : démarrage.
- Test : `apps/server/test/web-auth.test.ts`

Routes :
- `GET /login` ;
- `POST /login` : rate-limit de 10 requêtes par minute et par IP ;
- `POST /logout` ;
- `GET /` : redirige vers `/account` ou `/login` ;
- `GET /healthz` : renvoie `{ok:true}` si la base répond.

Session `@fastify/secure-session` : cookie `HttpOnly`, `SameSite=Lax`, `Secure` quand la requête arrive en HTTPS. Protection CSRF sur tous les POST du web. Langue : `user.locale`, sinon `Accept-Language`, sinon l'anglais.

- [x] **Step 1 : tests avec `app.inject`.**
  - Une connexion réussie renvoie un 302 vers `/account` avec un cookie posé.
  - Une connexion échouée renvoie un 200, la page affiche « Invalid credentials » ou « Identifiants invalides » selon la langue, et le nom d'utilisateur saisi est conservé.
  - `GET /account` sans session renvoie un 302 vers `/login`.
  - Un POST sans jeton CSRF renvoie un 403.
  - La 11e tentative de connexion dans la minute renvoie un 429.
  - `GET /healthz` renvoie un 200.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add Fastify app with web login, sessions and i18n"`

---

## Scope 4 — Serveur : invitations, clé API, réglages

Branche : `feature/server-account`.

### Tâche 4.1 : Invitations et inscription

**Files :**
- Create : `apps/server/src/users/invitations.ts`, `apps/server/src/web/routes-invite.ts`, et les vues `admin-invitations.eta` et `signup.eta`
- Test : `apps/server/test/invitations.test.ts`

**Interfaces :**
- Produit :
  - `createInvitation(db, adminId, publicUrl, ttlHours = 72): Promise<{ url: string }>` : jeton aléatoire de 32 octets en base64url, stocké haché en sha256 ; l'URL vaut `${PUBLIC_URL}/invite/<token>` ;
  - `consumeInvitation(db, token, {username, password}): Promise<User>`.
- Prérequis issus de la revue du scope 3 :
  - un preHandler `requireUser(db)` recharge l'utilisateur de la session depuis la base à chaque requête web authentifiée (supprime la session si l'utilisateur n'existe plus) et expose `is_admin` et `locale` depuis la base ; `/account` et `/admin/*` l'utilisent ;
  - `createUser` valide le nom d'utilisateur avant d'ouvrir l'inscription : 3 à 32 caractères, `[a-z0-9_.-]` après mise en minuscules.
- Routes :
  - `GET /admin/invitations` et `POST /admin/invitations` : réservées à l'admin, sinon 403 ;
  - `GET /invite/:token` et `POST /invite/:token` ;
  - `GET /signup` et `POST /signup` : uniquement si `OPEN_SIGNUP`, sinon 404.

- [x] **Step 1 : tests.**
  - Un admin crée une invitation, un invité l'utilise et peut se connecter.
  - Une invitation réutilisée, expirée ou inconnue renvoie un 410 avec un message clair.
  - Un utilisateur non admin reçoit un 403 sur `/admin/invitations`.
  - `/signup` renvoie un 404 avec `OPEN_SIGNUP=false`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.** Le marquage `used_at` et la création de l'utilisateur se font dans une même transaction.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add single-use invitations and optional open signup"`

### Tâche 4.2 : Clé API (génération, révocation, vérification)

**Files :**
- Create : `apps/server/src/auth/api-keys.ts`, `apps/server/src/web/routes-account.ts`
- Modify : la vue `account.eta` (placeholder créé au scope 3)
- Test : `apps/server/test/api-keys.test.ts`

**Interfaces :**
- Produit :
  - `generateApiKey(db, userId): Promise<string>` : la clé vaut `slk_` suivi de 32 octets aléatoires en base64url. Elle révoque la clé active précédente dans la même transaction, stocke le sha256 en hexadécimal et les 8 premiers caractères comme `key_prefix` ;
  - `revokeApiKey(db, userId)` ;
  - `authenticateApiKey(db, key): Promise<{ userId: string } | null>` : comparaison du hash, refus d'une clé révoquée.
- Routes :
  - `GET /account` : affiche le préfixe et la date de la clé active, sans jamais montrer la clé elle-même ;
  - `POST /account/api-key` : affiche la clé **une seule fois** dans la réponse ;
  - `POST /account/api-key/revoke`.

- [x] **Step 1 : tests.**
  - La clé générée s'authentifie.
  - Après régénération, l'ancienne clé renvoie `null` et la nouvelle reste valide.
  - Après révocation, la clé renvoie `null`.
  - La clé en clair n'apparaît nulle part en base : `select * from api_keys` ne la contient pas.
  - `GET /account` n'affiche jamais la clé en clair.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add personal API key management"`

### Tâche 4.3 : Réglages de valorisation par univers

**Files :**
- Create : `apps/server/src/settings/settings.ts`, et l'extension de `account.eta` (un formulaire par univers connu, tiré de `accounts`)
- Test : `apps/server/test/settings.test.ts`

**Interfaces :**
- Produit :
  - `getValuationSettings(db, userId, serverId, lang): Promise<ValuationSettings>` : renvoie `DEFAULT_VALUATION` si aucune ligne n'existe ;
  - `saveValuationSettings(db, userId, serverId, lang, s: ValuationSettings)` ;
  - Route `POST /account/settings/:serverId/:lang`.

- [x] **Step 1 : tests.**
  - Sans ligne en base, on obtient les valeurs par défaut.
  - Enregistrer puis relire `msuRatio [2.5,1.5,1]` rend la même valeur.
  - Un ratio ≤ 0 ou un `expeditionShipRatio` hors de [0, 100] est refusé.
  - Un utilisateur ne peut pas modifier les réglages d'un autre. Les réglages sont indexés par `user_id` de session, jamais par un paramètre.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add per-universe valuation settings"`

---

## Scope 5 — Serveur : API d'ingestion et de stats

Branche : `feature/server-api`.

### Tâche 5.1 : Authentification API, ping et version minimale du client

**Files :**
- Create : `apps/server/src/api/plugin.ts`, `apps/server/src/api/routes-ping.ts`
- Test : `apps/server/test/api-ping.test.ts`

**Interfaces :**
- Produit :
  - préfixe `/api/v1` ;
  - en-têtes `Authorization: Bearer <key>` et `X-Client-Version: <semver>` ;
  - `MIN_CLIENT_VERSION = '0.1.0'` ;
  - `GET /api/v1/ping` renvoie `{ ok: true, username, apiVersion: 1 }` ;
  - erreurs JSON `{ error: 'invalid_key' | 'client_outdated' | 'invalid_payload' | 'rate_limited', message }` ;
  - rate-limit de 120 requêtes par minute et par clé.

- [x] **Step 1 : tests.** Pas de clé ou mauvaise clé → 401 `invalid_key`. Clé révoquée → 401. Version `0.0.1` → 426 `client_outdated`. Clé valide → 200 avec `username`.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add API key auth, ping endpoint and client version gate"`

### Tâche 5.2 : Ingestion d'un lot d'observations

**Files :**
- Create : `apps/server/src/ingest/ingest.ts`, `apps/server/src/ingest/canonical.ts`, `apps/server/src/api/routes-observations.ts`
- Test : `apps/server/test/ingest.test.ts`

**Interfaces :**
- Consomme : `observationBatchSchema`, `parseMessage`, `parseFleetDispatch`, `dayKey` et `PARSER_VERSION` (scopes 1 et 2).
- Produit :
  - `ingestBatch(db, userId, batch: ObservationBatch): Promise<BatchAck>` ;
  - `POST /api/v1/observations`, avec une limite de corps de 2 Mo (413 au-delà) ;
  - `canonicalJson(value): string` : clés triées, pour comparer deux interprétations.

Algorithme, appliqué à chaque observation dans son propre savepoint :
1. Upsert du compte (`user_id`, `serverId`, `lang`, `playerId`), en mettant à jour `player_name`. Upsert de l'appareil (`last_seen`, `client_version`).
2. Insertion de l'observation avec `ON CONFLICT (user_id, client_observation_id) DO NOTHING`. Si rien n'est inséré, le statut est `duplicate`.
3. Interprétation, puis insertion de l'événement avec `ON CONFLICT (account_id, external_key) DO NOTHING` :
   - `status` vaut `ok` ou `unrecognized` ;
   - `day` vaut `dayKey(occurredAt, serverUtcOffsetMinutes)` quand `occurredAt` est connu ;
   - si l'insertion réussit, le statut est `accepted` ou `unrecognized`.
4. Si l'événement existait déjà :
   - existant `unrecognized` et nouvelle interprétation `ok` : on remplace `data`, `status` et `kind` (cas d'un parseur amélioré) → `accepted` ;
   - `canonicalJson` identique → `duplicate` ;
   - sinon, on garde `data` et on passe `status` à `conflict` → `conflict`.
5. Une observation qui échoue à la validation devient `rejected`, avec la `reason` de zod. Les autres observations du lot sont traitées normalement.

- [x] **Step 1 : tests.**
  - Un nouveau message donne `accepted`.
  - Le même `clientObservationId` renvoyé donne `duplicate`.
  - Le même `msgId` vu par un autre appareil (autre `clientObservationId`) avec le même brut donne `duplicate`, et un seul événement existe.
  - Le même `msgId` dont seul le `name` localisé de `technologiesgained` diffère donne `duplicate` (Review Focus 1).
  - Le même `msgId` avec des ressources différentes donne `conflict`, et `data` garde le premier état.
  - Deux `msgId` différents aux gains identiques donnent deux événements.
  - Un message de type 33 donne `unrecognized`, et son brut est conservé dans `observations.payload`.
  - Un lot mêlant une observation valide et une invalide donne `accepted` et `rejected`.
  - Deux utilisateurs envoient le même `msgId` : chacun a son propre événement.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add idempotent observation ingestion with conflict tracking"`

### Tâche 5.3 : Endpoint de stats

**Files :**
- Create : `packages/shared/src/api.ts` (`StatsPeriod`, `StatsResponse`, `ApiError` ; voir « Interfaces partagées »), `apps/server/src/stats/stats-service.ts`, `apps/server/src/api/routes-stats.ts`
- Test : `apps/server/test/stats-api.test.ts`

**Interfaces :**
- Consomme : `computeStats`, `periodRange` et `getValuationSettings`.
- Produit : `GET /api/v1/stats?serverId&lang&playerId&period=day|week|month|all&today=YYYY-MM-DD`, qui renvoie :

  ```
  {
    period, range: {from,to} | null, generatedAt,
    summary: StatsSummary,
    counts: { unrecognized: number },
    settings: ValuationSettings
  }
  ```

  Le client fournit `today`, parce qu'il connaît le jour serveur. Les événements `unrecognized` sont seulement comptés.

- [x] **Step 1 : tests.**
  - Après ingestion de deux expéditions (aujourd'hui et hier), `period=day` en compte une et `period=all` deux.
  - Avec un réglage `ignoreConsumption`, il est appliqué au résumé.
  - **Une clé d'un utilisateur A qui demande un compte de B obtient un résumé vide et `counts.unrecognized` à 0** (Review Focus 5).
  - Un `today` mal formé renvoie un 400 `invalid_payload`, y compris une date inexistante comme `2026-02-31` : la date doit se reformater à l'identique, une regex ne suffit pas.
  - `StatsPeriod` est un alias de `Period` (`time.ts`) : un seul nom exporté.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.** On récupère les événements `ok` et `conflict` du compte (filtré par `user_id`) sur la plage, puis on appelle `computeStats`.
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add stats endpoint for the in-game box"`

---

## Scope 6 — Docker et déploiement homelab

Branche : `feature/docker`.

### Tâche 6.1 : Image et composition

**Files :**
- Create :
  - `Dockerfile` : multi-étapes, base `node:26-alpine`, pnpm installé par `npm i -g pnpm@<version de packageManager>` (pas de corepack), build du serveur seul, exécution sous l'utilisateur `node`, `HEALTHCHECK` sur `/healthz` ;
  - `compose.yaml` : services `app` et `postgres:17-alpine`, volume `pgdata`, `app` qui dépend de `postgres` en état healthy, et migrations au démarrage (`node dist/cli.js migrate && node dist/index.js`) ;
  - `.env.example` ;
  - `.dockerignore` ;
  - `docs/deploy.md` : variables, création du `SESSION_SECRET` (`openssl rand -hex 32`), commande `create-admin` dans le conteneur, rappel sur le reverse proxy HTTPS et `PUBLIC_URL`, sauvegarde `pg_dump`. `TRUST_PROXY` vaut par défaut `loopback,linklocal,uniquelocal` : un proxy sur le réseau Docker, l'hôte ou le LAN est reconnu sans configuration, et un client public direct ne peut pas forger `X-Forwarded-For`. Publier quand même le port de l'app sur `127.0.0.1` ou sur le seul réseau du proxy. Documenter les autres formes (`true`, `false`, nombre de sauts — qui suppose une exposition par le proxy uniquement —, liste d'IP/CIDR), et le fait qu'un client à adresse privée (LAN, autre conteneur) est un saut de confiance : restreindre la liste à l'IP du proxy si le LAN n'est pas sûr.

- [x] **Step 1 : construire et démarrer.** `cp .env.example .env` (avec des valeurs de test), puis `docker compose up -d --build`.
- [x] **Step 2 : vérifier.** `curl -fsS localhost:3000/healthz` affiche `{"ok":true}`. `docker compose exec app node dist/cli.js create-admin --username admin` suivi de `/login` dans un navigateur permet de se connecter et de générer une clé.
- [x] **Step 3 : nettoyer.** `docker compose down -v`. Vérifier que `.env` est bien ignoré par git (`git status`).
- [x] **Step 4 : commit.** `git commit -m "Add Docker image, compose stack and deployment guide"`

---

## Scope 7 — Userscript : socle, file, options, consentement

Branche : `feature/userscript-foundation`. Tous les accès `GM_*` passent par un adaptateur, pour pouvoir le remplacer en test.

### Tâche 7.1 : Build, adaptateur GM et stockage

**Files :**
- Create :
  - `apps/userscript/vite.config.ts` (vite-plugin-monkey) :
    - `match: ['https://s808-en.ogame.gameforge.com/game/index.php*']` : **PTS uniquement** (Singularity, en_808) jusqu'à la tolérance, retiré au scope 14 ;
    - grants `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_xmlhttpRequest`, `GM_addStyle`, `GM_registerMenuCommand` ;
    - `connect: ['*']` ;
    - `build.minify: false` ;
    - `name: 'Starledger'` ; `@updateURL` est ajouté au scope 14.
  - `apps/userscript/src/gm.ts` : `interface Gm { get<T>(k, d: T): T; set(k, v): void; request(opts): Promise<{status:number; body:string}>; addStyle(css): HTMLStyleElement; menu(label, fn): void }`, plus `realGm` et `memoryGm()` (tests).
  - `apps/userscript/src/pts-guard.ts` : `PTS_UNIVERSES = ['s808-en.ogame.gameforge.com']` et `isAllowedUniverse(doc): boolean`, qui lit la meta `ogame-universe`. L'entrée du script l'appelle en premier et s'arrête si elle renvoie `false` : aucun encart, aucune collecte, aucun envoi. Commentaire de conformité : `// AGENTS.md §5: PTS only until toleration, removed in scope 14`.
  - `apps/userscript/src/storage.ts` : `ClientSettings = { serverUrl: string | null; apiKey: string | null; consent: boolean; hideOglightBox: boolean; deviceId: string }`, avec `loadSettings(gm)` (génère et enregistre `deviceId` au premier appel) et `saveSettings(gm, patch)`.
- Test : `apps/userscript/test/storage.test.ts`, `apps/userscript/test/build.test.ts`

- [x] **Step 1 : tests.**
  - Le premier `loadSettings` génère un UUID stable, identique au deuxième appel.
  - Les valeurs par défaut sont `consent:false` et `hideOglightBox:false`.
  - `isAllowedUniverse` renvoie `true` pour la meta `s808-en.ogame.gameforge.com`, et `false` pour `s1-fr.ogame.gameforge.com`, une meta absente ou vide.
  - Le `.user.js` construit contient `@match https://s808-en.ogame.gameforge.com/game/index.php*` et aucun `@match` avec `*.ogame`.
  - Après `pnpm --filter @app/userscript build`, le `.user.js` contient `// ==UserScript==` et `@grant GM_xmlhttpRequest`, mais aucun `@grant unsafeWindow` en trop. La moyenne des longueurs de ligne reste inférieure à 200, ce qui prouve qu'il n'est pas minifié.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add userscript build, GM adapter and settings storage"`

### Tâche 7.2 : Client API

**Files :**
- Create : `apps/userscript/src/sync/api.ts`
- Test : `apps/userscript/test/api.test.ts`

**Interfaces :**
- Produit :
  - `createApi(gm, settings, clientVersion)`, qui renvoie `{ ping(): Promise<ApiResult<{username:string}>>; sendBatch(b: ObservationBatch): Promise<ApiResult<BatchAck>>; getStats(q): Promise<ApiResult<StatsResponse>> }` ;
  - `ApiResult<T> = { ok: true; data: T } | { ok: false; error: 'not_configured'|'invalid_key'|'unreachable'|'client_outdated'|'server_error' }`.

- [x] **Step 1 : tests avec `memoryGm`** et des réponses simulées :
  - 401 → `invalid_key` ;
  - 426 → `client_outdated` ;
  - exception réseau → `unreachable` ;
  - 500 → `server_error` ;
  - URL ou clé absente → `not_configured`, sans aucune requête ;
  - l'URL appelée vaut `${serverUrl}/api/v1/ping`, sans double `/` ;
  - les en-têtes `Authorization` et `X-Client-Version` sont présents.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add userscript API client"`

### Tâche 7.3 : File persistante et vidage

**Files :**
- Create : `apps/userscript/src/sync/queue.ts`
- Test : `apps/userscript/test/queue.test.ts`

**Interfaces :**
- Produit :
  - `createQueue(gm)`, qui renvoie `{ enqueue(o: Observation[]): { accepted: number; refused: number }; size(): number; flush(api, deviceId): Promise<SyncState> }` ;
  - `SyncState = { status: 'up_to_date'|'pending'|'error'; pending: number; lastSyncAt: number | null; error: ApiError | null }`.
- Règles :
  - lots de 100 au plus ;
  - les éléments dont l'accusé est `accepted`, `duplicate`, `conflict` ou `unrecognized` sont retirés ;
  - les éléments `rejected` sont retirés, mais le nombre de rejets est conservé dans l'état ;
  - en cas d'erreur, rien n'est retiré ;
  - capacité de 5000 éléments : au-delà, `enqueue` refuse les nouveaux éléments (`refused` > 0, état `error`). On ne jette jamais d'anciens éléments en silence ;
  - un seul vidage à la fois (verrou en mémoire) ;
  - aucun minuteur.

- [x] **Step 1 : tests.**
  - Enqueue de 3 éléments, puis flush OK : la file est vide et l'état vaut `up_to_date`.
  - Flush avec `unreachable` : la file garde 3 éléments, l'état vaut `error` et `pending` vaut 3.
  - **Le serveur enregistre le lot mais le client « perd » la réponse** (l'API lève une exception après réception côté serveur simulé) : la file garde 3 éléments ; au flush suivant, les accusés `duplicate` vident la file (Review Focus 3).
  - Avec 5000 éléments en file, un nouvel enqueue est refusé.
  - Deux `flush()` simultanés ne produisent qu'un seul appel API.
  - Le code source ne contient ni `setInterval` ni `setTimeout` (test par lecture du fichier).
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add persistent observation queue with ack-based flush"`

### Tâche 7.4 : i18n, consentement, options et masquage de l'encart OGLight

**Files :**
- Create :
  - `apps/userscript/src/i18n.ts` (fr/en d'après la meta `ogame-language`, l'anglais par défaut) ;
  - `apps/userscript/src/ui/consent.ts`, `apps/userscript/src/ui/options.ts`, `apps/userscript/src/ui/oglight.ts`, `apps/userscript/src/ui/styles.ts` ;
  - `apps/userscript/src/main.ts` (bootstrap).
- Test : `apps/userscript/test/ui-options.test.ts`

Comportement :
- **Consentement.** Tant que `consent` est faux, le script n'affiche qu'un petit encart avec un bouton « Configurer », et ne collecte ni n'envoie rien. L'écran de consentement liste en clair ce qui est envoyé :
  - les rapports affichés : expéditions, combats (y compris noms et coordonnées des autres joueurs), recyclages, champs d'épaves, découvertes, transports, récompenses d'anomalies ;
  - les départs de flotte et leur carburant ;
  - les actions sur la page des anomalies : lithium et antimatière dépensés, et leur heure ;
  - l'identifiant du compte et l'univers ;
  - un identifiant d'appareil ;
  - et à quel serveur (l'URL saisie).

  Le consentement peut être retiré depuis les options.
- **Options**, ouvertes depuis l'encart et depuis `GM_registerMenuCommand` : URL du serveur, clé API (champ masqué), bouton « Tester la connexion » (`api.ping`, résultat ou message d'erreur traduit), case « Masquer l'encart OGLight ».
- **Masquage OGLight** : il ajoute ou retire un `<style>` contenant `.ogl_miniStats{display:none!important}`. Le code porte le commentaire `// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3`.

- [x] **Step 1 : tests jsdom.**
  - Sans consentement, `main()` n'enregistre aucun écouteur `ajaxSuccess` (vérifié par un espion sur un jQuery simulé).
  - Cocher le masquage ajoute la règle, et le décocher la retire.
  - Le test de connexion affiche « Clé invalide » quand l'API renvoie `invalid_key`, avec une meta `ogame-language` à `fr`.
  - Le retrait du consentement est enregistré.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : auto-audit.** Dérouler la checklist de `AGENTS.md` §7 et noter le résultat pour la PR.
- [x] **Step 6 : commit.** `git commit -m "Add consent screen, options panel and OGLight box toggle"`

---

## Scope 8 — Userscript : collecte des messages

Branche : `feature/userscript-messages`.

### Tâche 8.1 : Lecture du contexte de page

**Files :**
- Create : `apps/userscript/src/env/page.ts`
- Test : `apps/userscript/test/page.test.ts`

**Interfaces :**
- Produit :
  - `readAccount(doc): AccountRef | null` : lit les meta `ogame-universe` (`s<id>-<lang>.ogame…`), `ogame-player-id` et `ogame-player-name` ;
  - `readServerUtcOffset(win): number | null` : utilise `win.serverTime` et `computeServerUtcOffsetMinutes`, avec `-new Date().getTimezoneOffset()` comme décalage du navigateur ;
  - `todayKey(win): string | null`.

- [x] **Step 1 : tests.**
  - Une meta `s123-fr.ogame.gameforge.com` donne `serverId` 123 et `lang` `'fr'`.
  - Une meta absente donne `null`.
  - Avec `serverTime` simulé à +6 h et un navigateur à UTC−5, le décalage vaut 60.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Read account identity and server time offset from the page"`

### Tâche 8.2 : Extraction des messages et branchement passif

**Files :**
- Create : `apps/userscript/src/collect/messages.ts`, puis modification de `apps/userscript/src/main.ts`
- Test : `apps/userscript/test/messages.test.ts`, avec la fixture HTML `apps/userscript/test/fixtures/messages-expeditions.html` (synthétique, construite d'après `docs/ogame-data-formats.md` §1.4)

**Interfaces :**
- Consomme : `TRACKED_MESSAGE_TYPES`, `readAccount`, `readServerUtcOffset`, `createQueue`.
- Produit :
  - `extractMessageObservations(root: ParentNode, ctx): MessageObservation[]` : lit chaque `div.msg[data-msg-id]` et le dataset de `.rawMessageData`. Les clés `raw*` deviennent des clés en minuscules sans préfixe. Seuls les types de `TRACKED_MESSAGE_TYPES` sont gardés ; le `subtabId` vient de `.innerTabItem.active[data-subtab-id]` ;
  - `installMessageCollector(win, onObservations)`. On utilise `$(document).on('ajaxSuccess', …)` et on filtre `settings.url` sur `action=getMessagesList`, en ignorant `showTrash=true`. On parse alors `win.ogame.messages.content.join('')` avec `DOMParser`. Une lecture initiale du DOM a aussi lieu au chargement. Commentaire de conformité : `// AGENTS.md §4: passive read of a player-triggered response, no game request`.
- Après chaque extraction non vide : `queue.enqueue`, puis `queue.flush`, puis rafraîchissement de l'encart (scope 9).

- [x] **Step 1 : tests.**
  - La fixture HTML (2 expéditions, 1 rapport d'espionnage) donne 2 observations, avec `raw.expeditionresult` présent et `msgId` numérique.
  - Un même message vu deux fois sur la même page n'est mis en file qu'une fois (ensemble des `msgId` vus par chargement de page).
  - Un `ajaxSuccess` sur une autre URL ou avec `showTrash=true` ne déclenche rien.
  - Aucun appel à `fetch` ou `XMLHttpRequest` pendant la collecte : les deux sont espionnés dans jsdom.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : auto-audit** (`AGENTS.md` §7), noté pour la PR.
- [x] **Step 6 : commit.** `git commit -m "Collect displayed fleet messages passively"`

---

## Scope 9 — Userscript : encart et détail

Branche : `feature/userscript-box`.

### Tâche 9.1 : Encart

**Files :**
- Create : `apps/userscript/src/ui/box.ts`, `apps/userscript/src/ui/format.ts`, et le cache des dernières stats par compte dans `storage.ts`
- Test : `apps/userscript/test/box.test.ts`

**Interfaces :**
- Produit :
  - `renderBox(container, model: BoxModel)` ;
  - `BoxModel = { state: SyncState; stats: StatsResponse | null; statsAt: number | null; stale: boolean; configured: boolean; consent: boolean }` ;
  - `formatAmount(n: number | null): string` : `null` donne `'?'`, avec des unités k, M et G.
- Contenu :
  - tuiles métal, cristal, deut, AM, artefacts et MSU du jour ;
  - carburant (« ? » plus le nombre de départs inconnus quand `unknownCount` > 0) ;
  - ligne d'état : « à jour HH:MM », « N en attente » ou « erreur : … » ;
  - mention « ancien » quand les chiffres viennent du cache ;
  - un clic ouvre le détail.
- Insertion sous `#links`. Le style est responsive : en dessous de 768 px, on passe en grille 3 × 2 compacte. Rien n'est positionné en `fixed` ou `absolute` par-dessus le menu.

- [x] **Step 1 : tests.**
  - `formatAmount(null)` vaut `'?'` et `formatAmount(1500000)` vaut `'1.5M'`.
  - Avec `stale: true`, la mention « ancien » apparaît.
  - Avec `state.pending` à 4, « 4 en attente » apparaît.
  - Un `fuel.unknownCount` de 2 affiche « ? » dans la tuile carburant, et non 0.
  - L'encart est inséré après `#links`, sans toucher aux éléments `#menuTable` existants (comparaison du nombre et de l'ordre des enfants).
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add in-game stats box"`

### Tâche 9.2 : Fenêtre de détail

**Files :**
- Create : `apps/userscript/src/ui/details.ts`
- Test : `apps/userscript/test/details.test.ts`

Contenu (design §5.6) :
- boutons Jour, Semaine, Mois et Total, chacun déclenchant un `getStats` à l'ouverture ou au changement (pas de minuteur) ;
- répartition des résultats d'expédition, sous forme de liste avec pourcentages (pas de graphique au MVP) ;
- tableau des vaisseaux trouvés et perdus par id ;
- récapitulatif par catégorie (expéditions, combats, recyclages, FdV, champs d'épaves, carburant), avec les gains, les pertes et le carburant dans des colonnes séparées, et une phrase qui explique le périmètre du bilan net ;
- compteurs « non reconnus » et « conflits » quand ils sont supérieurs à 0.

- [x] **Step 1 : tests.**
  - Un clic sur « Semaine » déclenche `getStats` avec `period=week` et le bon `today`.
  - Avec 3 non reconnus, la fenêtre affiche « 3 rapports non reconnus ».
  - Les colonnes gains, pertes et carburant sont distinctes.
  - La fenêtre se ferme avec Échap et au clic sur le fond.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : auto-audit** (`AGENTS.md` §7), noté pour la PR.
- [x] **Step 6 : commit.** `git commit -m "Add stats detail dialog"`

---

## Scope 10 — Validation PTS : vraies captures, reparse, audit

Branche : `feature/pts-validation`. **Prérequis utilisateur** : serveur déployé (scope 6), script installé à la main **sur le PTS uniquement**, et un compte PTS actif.

### Tâche 10.1 : Captures réelles et correction des parseurs

**Files :**
- Create : `packages/shared/test/fixtures/messages-real/*.json`, avec `"synthetic": false`. Elles sont produites par une commande de debug du script (`GM_registerMenuCommand` « Exporter les observations en file (debug) »), qui télécharge la file en JSON sans rien envoyer.
- Modify : les parseurs selon les écarts constatés, et `docs/ogame-data-formats.md` (marquer « verified on PTS <date> » ou corriger).

- [ ] **Step 1 :** (2026-11-16 : 31 fixtures réelles couvrent 25, 32, 33, 41, 48, 61 et 76, tous les résultats d'expédition vus, les combats d'expédition pirates/aliens, défense perdue, sans butin et sans round ; listes vides écrites `[]`, pertes d'un combat d'expédition comptées une fois. **Manque : un message 54 réel.**) l'utilisateur affiche sur le PTS chaque type de message listé au design §9.2 et exporte la file. Captures à inclure en plus :
  - une expédition `combatPirates` ou `combatAliens` (41) **et** son rapport de combat en position 16 (25) : les pertes de vaisseaux ne doivent être déduites qu'une fois dans `computeStats` (aujourd'hui, les deux sources sont déduites) ;
  - un combat de défense sans réparation, un combat sans butin : confirmer que le jeu omet les listes vides ou écrit `[]`.
- [x] **Step 2 : écrire les tests** à partir des captures, avec les résultats attendus vérifiés à la main contre le message affiché. Lancer : les écarts apparaissent en FAIL.
- [x] **Step 3 : corriger** les parseurs et incrémenter `PARSER_VERSION`.
- [x] **Step 4 : lancer** `pnpm test`. Attendu : PASS.
- [ ] **Step 5 : vérifier sur le PTS** l'unicité entre deux appareils : un même rapport lu sur PC puis sur mobile n'apparaît qu'une fois dans l'encart.
- [ ] **Step 6 : commit.** `git commit -m "Validate parsers against real PTS captures"`

### Tâche 10.2 : Réinterprétation de l'historique

**Files :**
- Create : la commande CLI `reparse [--user <username>]` dans `apps/server/src/cli.ts`, et `apps/server/src/ingest/reparse.ts`
- Test : `apps/server/test/reparse.test.ts`

**Interfaces :**
- Produit : `reparseEvents(db, opts): Promise<{ updated: number; stillUnrecognized: number; newConflicts: number }>`. Pour chaque événement `unrecognized`, ou dont `parser_version` est inférieur à `PARSER_VERSION`, on réinterprète la première observation et on applique les règles du scope 5, tâche 2, étape 4.

- [x] **Step 1 : tests.**
  - Un événement `unrecognized` dont le parseur existe désormais (parseur simulé) devient `ok`.
  - Un événement `ok` déjà à jour n'est pas modifié.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : commit.** `git commit -m "Add history reparse command"`

### Tâche 10.3 : Types de message non suivis

Décision utilisateur du 2026-11-12 (`docs/decisions.md`) : les arrivées de flotte (34) éventuellement stockées par un ancien client gonflent le compteur de non reconnus.

- L'ingestion ignore une observation `message` dont le type n'est pas dans `TRACKED_MESSAGE_TYPES` (réponse comptée comme ignorée, rien n'est stocké).
- Le `reparse` retire de l'historique les événements existants de ces types (ou les exclut des stats, au choix de l'implémentation, justifié dans `docs/decisions.md`).
- Tests : une observation 34 reçue n'est pas stockée ; un événement 34 déjà stocké sort du compteur de non reconnus après `reparse`.
- [x] Fait (2026-11-16) : réponse `duplicate` (raison `untracked message type`), suppression par `reparse` (compteur `removed`) ; `docs/decisions.md`.

---

## Scope 11 — Carburant

Branche : `feature/userscript-fuel`.

### Tâche 11.1 : Vérifications sur le PTS (spike jetable, sans code conservé)

- [x] Sur le PTS, vérifier avec les outils de dev :
  1. l'envoi de flotte passe-t-il par `$.ajax` ou `$.post`, et déclenche-t-il bien les événements jQuery globaux `ajaxSend` et `ajaxSuccess` ?
  2. `fleetDispatcher.getConsumption()` et les autres champs du §6.1 sont-ils encore lisibles dans `ajaxSend` ?
  3. `miniFleet` déclenche-t-il `ajaxSuccess`, et quelle est la forme exacte de sa réponse ?
  4. un rappel rembourse-t-il du deutérium ?
- [x] Noter les réponses dans `docs/ogame-data-formats.md` §6. **Si le point 1 ou 2 est négatif**, s'arrêter et revoir l'approche avec l'utilisateur. Remplacer une fonction du jeu est exclu (Global Constraints).

### Tâche 11.2 : Collecte passive des départs

**Files :**
- Create : `apps/userscript/src/collect/fleet.ts`, puis modification de `main.ts`
- Test : `apps/userscript/test/fleet.test.ts`

**Interfaces :**
- Produit : `installFleetCollector(win, onObservations)`.
  - **Page d'envoi de flotte** : à `ajaxSend` vers `fleetDispatcher.sendFleetUrl`, on prend un instantané de `mission`, `currentPlanet`, `targetPlanet`, `shipsToSend` et `getConsumption()`, rattaché à l'objet `jqXHR`. À `ajaxSuccess`, on parse la réponse : si `success === true`, on crée une observation `fleet_dispatch` (`source: 'fleetdispatch'`, `sentAt: Date.now()`). Sinon (erreur, limite d'attaque atteinte), on ne fait rien.
  - **`miniFleet`** : à `ajaxSend`, on lit les paramètres `mission`, `galaxy`, `system`, `position`, `type` et `shipCount`. À `ajaxSuccess`, si `response.success`, on crée une observation `source: 'minifleet'` avec `consumption: null`. `ships` vaut `{ '210': shipCount }` pour la mission 6, `{ '209': shipCount }` pour la mission 8, et `{}` sinon.
  - Commentaire de conformité : `// AGENTS.md §0/§4: observe only, never wrap or replace fleetDispatcher`.

- [x] **Step 1 : tests avec un jQuery et un `fleetDispatcher` simulés.**
  - Un envoi réussi donne une observation, avec `consumption` égale à la valeur de l'instantané.
  - `success:false` ne donne rien.
  - Un `ajaxSend` sans `ajaxSuccess` (annulation) ne donne rien.
  - Un `miniFleet` réussi donne `consumption: null`.
  - `fleetDispatcher.submitFleet2` est toujours la même référence après l'installation du collecteur, preuve qu'il n'a pas été remplacé.
- [x] **Step 2 : lancer.** Attendu : FAIL.
- [x] **Step 3 : implémenter.**
- [x] **Step 4 : lancer.** Attendu : PASS.
- [x] **Step 5 : vérifier sur le PTS.** Une expédition envoyée augmente le carburant de l'encart de la valeur affichée par le jeu. Un envoi refusé ne change rien. (2026-11-16 : 33069 affiché = 33069 enregistré ; 13 expéditions envoyées = 13 observations ; 3 envois refusés, aucune observation.)
- [x] **Step 6 : auto-audit** (`AGENTS.md` §7), noté pour la PR.
- [x] **Step 7 : commit.** `git commit -m "Track fuel of confirmed fleet dispatches passively"`

---

## Scope 12 — Transports entre joueurs

Captures reçues le 2026-11-12 : les trois cas sont du type 33 (`docs/ogame-data-formats.md` §3.7).

- [x] 12.1 parseur et stats
- [x] 12.2 affichage dans le détail
- [x] 12.3 partenaire des transports (décision utilisateur du 2026-11-12, `docs/decisions.md`)

Travail prévu :
- un parseur `TransportEvent` `{kind:'transport', direction:'received'|'delivered'|'internal', resources}`, sans identité ni coordonnées du partenaire (`docs/decisions.md`, scope 12) ; les transports internes ne sont comptés nulle part ;
- l'ajout de la catégorie « Échanges » à `StatsSummary` (reçu, envoyé, net), qui n'entre dans les tuiles que si `includeTradesInBalance` est vrai ;
- le type 34 n'est plus collecté ; les événements de type 33 déjà stockés sont réinterprétés par le `reparse` existant (les événements non reconnus sont toujours reparsés) ;
- l'affichage dans le détail.

### Tâche 12.3 : Partenaire des transports

Branche : `feature/transport-partner`, après le scope 13.

- `TransportEvent` gagne `partner: { playerId: number; playerName: string; coords: Coords & { type: 1 | 3 } } | null` : la planète cible pour `delivered`, la planète source pour `received`, `null` pour `internal` (attributs `source*` / `target*`, `docs/ogame-data-formats.md` §3.7).
- Un attribut du partenaire absent ou illisible rend le message non reconnu, jamais un partenaire partiel.
- `PARSER_VERSION` incrémenté, pour que le `reparse` complète les transports déjà stockés.
- Aucun affichage par partenaire dans cette tâche.
- À revoir avant la publication (scope 14) selon la réponse des ToolDevs sur les données d'autres joueurs.

## Scope 13 — Anomalies

Captures reçues le 2026-11-12 (formats dans `docs/ogame-data-formats.md` §3.9 et §9, règles dans `docs/decisions.md`). Cinq tâches : 13.1 combats d'anomalie, 13.2 récompenses du message 76, 13.3 lithium de la page des anomalies, 13.4 affichage, 13.5 réglage `anomalyShipRatio`. Les captures encore manquantes sont listées dans `docs/pts-captures.md` et ne le bloquent pas.

- [x] 13.1 combats d'anomalie
- [x] 13.2 récompenses du message 76
- [x] 13.3 lithium de la page des anomalies
- [x] 13.4 affichage
- [x] 13.5 réglage anomalyShipRatio

Travail prévu :
- l'observation des actions sur la page dédiée (scan, choix, récupération, remboursement), en lecture seule ;
- un événement par étape ;
- les chiffres « lithium dépensé », « lithium remboursé » et « net » ;
- les récompenses dans une catégorie « anomalies » ;
- une règle d'exclusion ou de rattachement si les missions d'anomalie produisent aussi des rapports de combat ou de transport classiques.

### Tâche 13.5 : Réglage `anomalyShipRatio`

Décision utilisateur du 2026-11-12 : les vaisseaux des récompenses d'anomalie sont valorisés selon un réglage serveur par univers, comme `expeditionShipRatio`.

- `ValuationSettings.anomalyShipRatio` (défaut 100), utilisé par `computeStats` pour `anomaly_reward`.
- Migration `0002` : colonne `universe_settings.anomaly_ship_ratio` (entier, défaut 100), avec `down`.
- `apps/server/src/settings/settings.ts`, `routes-account.ts`, le formulaire et l'i18n du serveur : même traitement que `expeditionShipRatio` (entier de 0 à 100).
- Tests : stats avec un ratio différent de 100, lecture et écriture du réglage, migration.

## Scope 14 — Dossier de tolérance et publication

Branche : `feature/toleration-release`. **Prérequis** : réponses écrites des ToolDevs aux questions du design §9.4.

### Tâche 14.1 : Métadonnées de diffusion et documents

**Files :**
- Modify : `apps/userscript/vite.config.ts` (nom définitif, `namespace`, `@homepageURL`, `@supportURL`, `@updateURL` et `@downloadURL` vers Greasy Fork, `version` synchronisée avec le package)
- Create :
  - `CHANGELOG.md`, au format exigé (design §10) : par fonctionnalité, les données collectées, leurs sources, les requêtes, l'envoi externe, l'automatisation et les modifications d'interface ;
  - `docs/toleration-submission.md` : le texte du dossier en anglais, qui suit le modèle du fil 332 et le design §10 étape 3, avec la déclaration de conformité et la checklist de `AGENTS.md` §7 cochée ;
  - `docs/privacy.md` : ce que le serveur stocke, l'isolation, la suppression sur demande ;
  - `THIRD_PARTY_NOTICES`, seulement si du code d'OGLight a été repris.
- Modify : `AGENTS.md`, resynchronisé depuis la source en mettant à jour l'en-tête.

- [ ] **Step 0 :** retirer le garde-fou PTS : `@match` élargi à `https://*.ogame.gameforge.com/game/index.php*`, suppression de `pts-guard.ts`, de son appel et de ses tests. Cette version est celle soumise aux reviewers ; l'utilisateur ne l'installe pas sur ses comptes réels avant la tolérance.
- [ ] **Step 1 :** si la réponse des ToolDevs sur le masquage d'OGLight est négative, retirer la fonctionnalité et ses tests. Si elle est positive, garder le marqueur `GRAY AREA` et citer l'accord dans le dossier.
- [ ] **Step 2 :** construire (`pnpm build`), vérifier que le `.user.js` n'est pas minifié et que son en-tête est complet, puis faire une dernière passe sur le PTS.
- [ ] **Step 3 :** `pnpm test && pnpm lint && pnpm typecheck`. Attendu : PASS.
- [ ] **Step 4 : commit.** `git commit -m "Prepare toleration submission and release metadata"`
- [ ] **Step 5 (utilisateur) :** figer la version (tag), ouvrir le fil dans Submissions & API Requests, et ne rien publier pendant la revue. Après la tolérance, publier sur Greasy Fork.

## Scope 15 — Renovate

Branche : `feature/renovate`. **Prérequis** : dépôt sur GitHub, et application Renovate installée sur le dépôt par l'utilisateur. Pas de Dependabot.

Travail prévu : `.github/renovate.json`, repris de la convention des projets perso (`flixpatrol` et `Varken`), avec les ajustements validés le 2026-11-11 :
- `extends` : `config:recommended`, `:dependencyDashboard`, `helpers:pinGitHubActionDigests` ;
- `baseBranchPatterns: ["develop"]`, `labels: ["dependencies"]`, `schedule: ["before 6am on monday"]` ;
- `minimumReleaseAge: "1 day"` et `internalChecksFilter: "strict"`, obligatoires avec pnpm 12 ;
- `platformAutomerge: false` et `automergeSchedule: ["at any time"]` ;
- trois groupes en automerge :
  - npm : mineur et correctif ;
  - github-actions : mineur, correctif, `digest` et `pinDigest` ;
  - dockerfile : mineur, correctif et `digest` ;
- `@types/node` avec `allowedVersions: "<=26"`.

## Scope 16 — Détail façon OGLight

Branche : `feature/details-dashboard`. **Spec** : `docs/superpowers/specs/2026-11-12-details-dashboard-design.md` (fait foi ; ses « Choix de l'assistant » sont à appliquer tels quels).

**Contraintes propres au scope** (en plus des Global Constraints) :
- Le client ne calcule aucune stat : tout chiffre affiché (lignes, MSU par ligne, vaisseaux, série par jour) vient du serveur ; le client ne fait que la mise en forme et les pourcentages du donut.
- Icônes : composants du jeu s'ils sont définis sur la page, sinon images statiques du CDN de Gameforge (aucune requête au serveur du jeu, aucune activité). Commentaire de conformité sur ce choix.
- Une case inconnue garde `+ ? (n)` ; une case sans objet affiche `-`.
- Mobile : la fenêtre tient dans la largeur ; le tableau défile horizontalement avec la première colonne fixe ; donut et vaisseaux l'un sous l'autre sous 560 px.

**Review Focus du scope :**
1. Compte sans aucun événement sur la période : tout à 0 ou `-`, donut vide sans division par zéro (pas de `NaN %`).
2. Serveur ancien sans `rows`, `ships` ni `days` : le détail affiche `?` sans planter (tests en 16.4 à 16.6).
3. Mois de 28, 29, 30 et 31 jours, et changement de mois depuis le 31 (31 janvier → février) : le calendrier a le bon nombre de jours et la date de référence reste valide (tests en 16.4).
4. Valeurs négatives (combats, carburant, lithium) : signe et couleur de perte, jamais `-0` (tests en 16.5 et 16.6).
5. Clics rapides sur les jours ou les mois : seule la dernière réponse s'affiche (le compteur `seq` existant, test en 16.4).

### Tâche 16.1 : Lignes du détail et vaisseaux dans `StatsSummary`

**Files :** Modify `packages/shared/src/stats.ts` ; Test `packages/shared/test/stats.test.ts`.

**Interfaces :**
- Produit :
  - `export type DetailRowKey = 'expeditions' | 'combats' | 'recycling' | 'wreckfields' | 'anomalies' | 'discoveries' | 'fuel' | 'trades' | 'total'` ;
  - `export type DetailRow = { count: number | null; resources: Resources | null; msu: number | null; darkMatter: number | null; artefacts: number | null; lithium: number | null; unknown: number }` (`null` = sans objet, affiché `-` ; `unknown` = nombre de valeurs inconnues de la ligne) ;
  - `StatsSummary.rows: Record<DetailRowKey, DetailRow>` et `StatsSummary.ships: { found: ShipCounts; lost: ShipCounts }` ;
  - `export function toMsu(res: Resources, ratio: [number, number, number]): number`, la formule des Global Constraints (`ceil`, `+ 0` contre `-0`), réutilisée par la tuile MSU.
- Règles (spec, « Choix de l'assistant » et option A) :
  - `resources` d'une catégorie = `balance[cat].gains − balance[cat].losses` (vaisseaux convertis compris) ; `msu = toMsu(resources)` ;
  - `count` : nombre d'événements de la catégorie ; anomalies = combats d'anomalie + récompenses ; fuel = `fuel.departures` ; trades = reçus + envoyés ; total = somme des lignes affichées ;
  - `darkMatter` : expéditions seulement (`expeditions.darkMatter`), total = `tiles.darkMatter` ; l'AM payée des anomalies n'y entre pas (elle reste dans `anomalies.lithium.darkMatterSpent`) ;
  - `artefacts` : expéditions (nouveau compteur `expeditions.artefacts`) et découvertes (`discoveries.artefacts`), total = `tiles.artefacts` ;
  - `lithium` : anomalies et total = `anomalies.lithium.net` ; `unknown` des anomalies et du total inclut `spentUnknown + refundUnknown` ;
  - fuel : `resources = { metal: 0, crystal: 0, deuterium: −recorded }` sauf si `ignoreConsumption` (alors `null`) ; `unknown = fuel.unknownCount` ;
  - discoveries : `resources` et `msu` à `null` ;
  - trades : ligne remplie seulement si `includeTradesInBalance`, sinon toutes les valeurs à `null` et `count` à `null` ;
  - total : `resources` = tuiles métal/cristal/deut, `msu = tiles.msu`, `unknown` = somme des `unknown` ;
  - `ships.found` = trouvés en expédition + récompenses d'anomalie + récupérés sur champs d'épaves ; `ships.lost` = pertes d'expédition + combats (`shipsLost` et `expeditionShipsLost`) + combats d'anomalie, indépendamment de `ignoreExpeShipsLoss`.

- [ ] **Step 1 : tests** (`describe('detail rows')`) : un jeu d'événements mêlant expédition avec vaisseaux trouvés et AM, combat perdu en défense, recyclage, champ d'épaves, récompense d'anomalie, action d'anomalie, découverte avec artefacts, départ de carburant connu et inconnu ; asserts :
  - `rows.total.resources` égal à `{ metal: tiles.metal, crystal: tiles.crystal, deuterium: tiles.deuterium }` et `rows.total.msu === tiles.msu` ;
  - `rows.combats.resources.metal < 0` quand les pertes dépassent le butin ;
  - `rows.discoveries.resources === null`, `rows.discoveries.artefacts` égal aux artefacts trouvés ;
  - `rows.fuel.unknown === 1`, `rows.fuel.resources.deuterium === −recorded`, et `rows.fuel.resources === null` avec `ignoreConsumption` ;
  - `rows.anomalies.darkMatter === null` et `rows.total.darkMatter === tiles.darkMatter` malgré une récupération en AM ;
  - `rows.trades.count === null` sans `includeTradesInBalance`, rempli avec ;
  - `ships.found` et `ships.lost` sommés sur toutes les sources ;
  - aucun événement : toutes les lignes à 0 ou `null`, `toMsu` ne renvoie jamais `-0`.
- [ ] **Step 2 :** `pnpm --filter @app/shared exec vitest run test/stats.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter dans `computeStats` (et `toMsu`).
- [ ] **Step 4 :** même commande → PASS ; `pnpm test:coverage` depuis la racine → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Add detail rows and ship totals to the stats summary"`

### Tâche 16.2 : Série par jour du mois

**Files :** Modify `packages/shared/src/api.ts`, `apps/server/src/stats/stats-service.ts` ; Test `apps/server/test/stats-api.test.ts`.

**Interfaces :**
- Consomme : `computeStats`, `periodRange('month', today)`.
- Produit : `StatsResponse.days: { day: string; msu: number }[]`, un élément par jour du mois qui contient `today`, dans l'ordre, `msu` = `tiles.msu` de ce seul jour (0 sans événement, négatif possible). Calculé quelle que soit la période demandée ; une seule requête SQL supplémentaire au plus (aucune si `period === 'month'`).

- [ ] **Step 1 : tests** : `today=2026-02-10` donne 28 éléments de `2026-02-01` à `2026-02-28` ; `2028-02-10` en donne 29 ; un jour avec une expédition rentable a `msu > 0`, un jour avec seulement du carburant `msu < 0`, les autres 0 ; avec `period=day` la série couvre quand même le mois ; un compte d'un autre utilisateur donne une série de zéros.
- [ ] **Step 2 :** `pnpm --filter @app/server exec vitest run test/stats-api.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter dans `getStats`.
- [ ] **Step 4 :** même commande → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Return the per-day MSU series of the month with the stats"`

### Tâche 16.3 : Icônes du jeu

**Files :** Create `apps/userscript/src/ui/icons.ts` ; Test `apps/userscript/test/icons.test.ts`.

**Interfaces :**
- Produit :
  - `export type IconKind = 'metal' | 'crystal' | 'deuterium' | 'darkMatter' | 'artefacts' | 'lithium'` ;
  - `export function resourceIcon(doc: Document, kind: IconKind, title: string): HTMLElement` ;
  - `export function shipIcon(doc: Document, shipId: string, title: string): HTMLElement`.
- Règle : si `doc.defaultView?.customElements.get(tag)` est défini, créer le composant du jeu (`<resource-icon class="metal|crystal|deuterium" sq16>`, `<technology-icon <nom technique>>` d'après `SHIP_TECH_NAMES`, `<lithium-icon sq16>`) ; sinon une image statique :
  - ressources et AM : sprite `https://gf3.geo.gfsrv.net/cdned/7f14c18b15064d2604c5476f5d10b3.png` (`background-size: 302px`, cadre 28×18), positions métal `1% 11%`, cristal `16% 11%`, deut `30% 11%`, AM `57% 11%` ;
  - artefacts : `https://gf1.geo.gfsrv.net/cdn65/596ba85baa74145390e04f7428d93e.png` (provisoire, à confirmer sur le PTS en 16.7) ;
  - lithium : toujours `<lithium-icon sq16>` (aucune image de secours connue) ;
  - vaisseaux : table `SHIP_IMAGES` id → URL, valeurs relevées le 2026-11-12 : 202 `https://gf2.geo.gfsrv.net/cdnd9/60555c3c87b9eb3b5ddf76780b5712.jpg`, 203 `https://gf1.geo.gfsrv.net/cdn34/fdbcc505474e3e108d10a3ed4a19f4.jpg`, 204 `https://gf2.geo.gfsrv.net/cdnd2/9ed5c1b6aea28fa51f84cdb8cb1e7e.jpg`, 205 `https://gf1.geo.gfsrv.net/cdnf1/8266a2cbae5ad630c5fedbdf270f3e.jpg`, 206 `https://gf2.geo.gfsrv.net/cdn45/b7ee4f9d556a0f39dae8d2133e05b7.jpg`, 207 `https://gf1.geo.gfsrv.net/cdn32/3f4a081f4d15662bed33473db53d5b.jpg`, 208 `https://gf1.geo.gfsrv.net/cdn6f/41a21e4253d2231f8937ddef1ba43e.jpg`, 209 `https://gf1.geo.gfsrv.net/cdn07/6246eb3d7fa67414f6b818fa79dd9b.jpg`, 210 `https://gf3.geo.gfsrv.net/cdnb5/347821e80cafc52aec04f27c3a2a4d.jpg`, 211 `https://gf1.geo.gfsrv.net/cdnca/4d55a520aed09d0c43e7b962f33e27.jpg`, 212 `https://gf2.geo.gfsrv.net/cdnda/665c65072887153d44a6684ec276e9.jpg`, 213 `https://gf3.geo.gfsrv.net/cdn2a/c2b9fedc9c93ef22f2739c49fbac52.jpg`, 214 `https://gf3.geo.gfsrv.net/cdn84/155e9e24fc1d34ed4660de8d428f45.jpg`, 215 `https://gf3.geo.gfsrv.net/cdn5a/24f511ec14a71e2d83fd750aa0dee2.jpg`, 217 `https://gf3.geo.gfsrv.net/cdn26/28e8d79a5b489dc795cc47f3adf165.jpg`, 218 `https://gf1.geo.gfsrv.net/cdn39/12d016c8bb0d71e053b901560c17cc.jpg`, 219 `https://gf3.geo.gfsrv.net/cdne2/b8d8d18f2baf674acedb7504c7cc83.jpg` ; id inconnu → vignette vide avec le `title`.
- Commentaire : `//! AGENTS.md §4: game components or static Gameforge CDN images, no game request`.

- [ ] **Step 1 : tests** : sans composant défini, `resourceIcon(doc,'metal',…)` a le sprite et la position `1% 11%` ; avec `customElements.define('resource-icon', …)` simulé, c'est un `<resource-icon class="metal" sq16>` ; `shipIcon(doc,'202',…)` donne une image à l'URL 202, ou `<technology-icon transportersmall>` si défini ; `lithium` est toujours `<lithium-icon>` ; tout élément porte le `title`.
- [ ] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/icons.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** même commande → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Add game icons with static CDN fallback"`

### Tâche 16.4 : Période, navigation et calendrier

**Files :** Create `apps/userscript/src/ui/details/calendar.ts` ; Modify `apps/userscript/src/ui/details.ts`, `apps/userscript/src/i18n.ts`, `apps/userscript/src/ui/styles.ts` ; Test `apps/userscript/test/details.test.ts`, `apps/userscript/test/calendar.test.ts`.

**Interfaces :**
- Consomme : `StatsResponse.days` (16.2).
- Produit :
  - `export function renderCalendar(doc: Document, days: { day: string; msu: number }[] | undefined, selected: string, onSelect: (day: string) => void): HTMLElement` : une barre par élément de `days` (`data-day`), hauteur proportionnelle à `|msu|` rapporté au plus grand `|msu|` du mois, classe `is-negative` si `msu < 0`, `aria-pressed` sur le jour sélectionné ; sans `days`, un calendrier vide ;
  - dans `openDetails` : état `{ period: StatsPeriod; refDay: string }`, initialisé à `{ 'day', todayKey(...) }` ; `refDay` est envoyé comme `today` à `getStats` ; boutons J/S/M/Tout (`periodDay`, `periodWeek`, `periodMonth`, `periodAll`), boutons ‹ › (`prevMonth`, `nextMonth`) qui déplacent `refDay` au même jour du mois voisin, ramené au dernier jour s'il n'existe pas ; libellé du mois localisé (`Intl.DateTimeFormat`, langue de l'interface) ; clic sur un jour → `{ period: 'day', refDay: jour }`.
  - Chaque changement déclenche une seule requête `getStats` (aucune pour un clic sur la période déjà affichée).

- [ ] **Step 1 : tests** : `renderCalendar` (28 barres pour février, barre négative marquée, jour sélectionné, clic appelle `onSelect('2026-02-14')`, `days` absent → aucun `NaN` dans les styles) ; `openDetails` avec une API simulée : ‹ depuis `2026-03-31` envoie `today=2026-02-28`, un clic sur un jour envoie `period=day&today=<jour>`, deux clics rapides n'affichent que la seconde réponse, un recliquage sur la période active n'envoie rien.
- [ ] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/calendar.test.ts test/details.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** même commande → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Add period navigation and month calendar to the detail window"`

### Tâche 16.5 : Donut des expéditions et grille des vaisseaux

**Files :** Create `apps/userscript/src/ui/details/donut.ts`, `apps/userscript/src/ui/details/ships.ts` ; Modify `ui/details.ts`, `ui/styles.ts` ; Test `apps/userscript/test/donut.test.ts`, `apps/userscript/test/ships-grid.test.ts`.

**Interfaces :**
- Consomme : `summary.expeditions.outcomes`, `summary.ships` (16.1), `shipIcon` (16.3).
- Produit :
  - `export function renderDonut(doc: Document, t: T, outcomes: Record<string, number> | undefined): HTMLElement` : SVG (un arc par résultat non nul, couleurs fixes par résultat), total au centre, légende (libellé `OUTCOME_KEYS`, nombre, pourcentage à une décimale, virgule ou point selon la langue) ; total 0 → cercle vide et légende sans pourcentage ;
  - `export function renderShips(doc: Document, t: T, ships: { found: ShipCounts; lost: ShipCounts } | undefined): HTMLElement` : une vignette par id de `SHIP_TECH_NAMES` trié, nombre trouvé (`formatAmount`), nombre perdu en dessous en `-n` (classe de perte) seulement s'il est > 0 ; `ships` absent → `?`.

- [ ] **Step 1 : tests** : 19 / 8 / 5 sur 32 donnent `59,4 %`, `25,0 %`, `15,6 %` en français ; total 0 → aucun `NaN` ; vaisseau trouvé 400 et perdu 20 affiche `400` et `-20` ; perdu 0 n'affiche pas de ligne de perte ; nombre de vignettes = nombre d'entrées de `SHIP_TECH_NAMES`.
- [ ] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/donut.test.ts test/ships-grid.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** même commande → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Add expedition donut and ship grid to the detail window"`

### Tâche 16.6 : Tableau et informations hors tableau

**Files :** Create `apps/userscript/src/ui/details/table.ts` ; Modify `ui/details.ts` (retrait de l'ancien rendu : `outcomesList`, `shipsTable`, `balanceTable`, `lithiumText`, `discoveriesText`, `tradesNetNote` et leurs clés i18n devenues inutiles), `i18n.ts`, `ui/styles.ts` ; Test `apps/userscript/test/details-table.test.ts`, `apps/userscript/test/details.test.ts`.

**Interfaces :**
- Consomme : `summary.rows` (16.1), `resourceIcon` (16.3), `formatAmount`, `formatPartial`.
- Produit : `export function renderTable(doc: Document, t: T, stats: StatsResponse): HTMLElement` et `export function renderNotes(doc: Document, t: T, stats: StatsResponse): HTMLElement`.
  - Colonnes : nombre, métal, cristal, deut, MSU, AM, artefacts, lithium ; en-têtes = icônes avec libellé en `title`.
  - Lignes dans l'ordre `expeditions, combats, recycling, wreckfields, anomalies, discoveries, fuel, trades (si count non null), total` ; `null` → `-` ; valeur négative avec la classe de perte ; `unknown > 0` → `formatPartial` sur le MSU et sur la colonne concernée (deut pour fuel, lithium pour anomalies, MSU pour total).
  - Infobulle (`title`) des lignes expéditions, combats, champs d'épaves, anomalies : « valeur des vaisseaux incluse » ; ligne anomalies : AM payée.
  - `renderNotes` : carburant inconnu (départs), lithium dépensé / remboursé / inconnus, AM payée, issues des combats (gagnés, perdus, nuls), XP des découvertes, échanges non inclus (reçus, envoyés, net), messages non reconnus, conflits — chaque note seulement si elle a un contenu.
  - Le tableau est dans un conteneur à défilement horizontal, première colonne `position: sticky`.

- [ ] **Step 1 : tests** : une réponse type rend 9 lignes avec trades inclus, 8 sans ; `rows.discoveries.resources: null` rend `-` dans métal/cristal/deut/MSU ; `rows.combats.resources.metal < 0` a la classe de perte ; `rows.fuel.unknown = 2` affiche `+ ? (2)` ; `rows.total.msu` égal à la tuile MSU de la réponse ; réponse sans `rows` → cases `?` sans exception ; les notes vides n'apparaissent pas ; plus aucune référence aux anciennes fonctions supprimées.
- [ ] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/details-table.test.ts test/details.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS.
- [ ] **Step 5 : commit.** `git commit -m "Render the detail balance as an OGLight-style table"`

### Tâche 16.7 : Vérification sur le PTS (utilisateur)

- [x] L'utilisateur installe le script de la branche sur le PTS, ouvre le détail sur PC et sur téléphone, et vérifie : icônes (ressources, vaisseaux, lithium, artefacts), lisibilité, navigation J/S/M/Tout et mois, chiffres du Total égaux aux tuiles de l'encart.
- [x] Ajustements éventuels dans la même branche (icône des artefacts notamment), avant le merge.

## Scope 17 — Période personnalisée

Branche : `feature/custom-period`, partie de `feature/details-dashboard` (PR #47 non mergée, le code du scope 16 n'est pas dans `develop`) ; à rebaser sur `develop` après le merge de #47. **Spec** : `docs/superpowers/specs/2026-11-13-custom-period-design.md` (fait foi).

**Contraintes propres au scope** :
- Une seule requête vers notre serveur par période choisie, au relâchement ; rien pendant le glisser, aucun minuteur (`AGENTS.md` §1.3, §4).
- Plage limitée au mois affiché ; `days` reste le mois de `today`.
- `touch-action: pan-y` sur le calendrier : le défilement vertical de la page reste possible au doigt.

**Review Focus du scope :**
1. Glisser de droite à gauche : bornes triées (test en 17.2).
2. Relâcher hors du calendrier : le glisser se termine sur le dernier jour survolé, pas de glisser bloqué (capture du pointeur, test en 17.2).
3. Le `click` qui suit un glisser ne relance pas une requête « jour » (test en 17.2).
4. Serveur : `from > to`, date irréelle, `to` manquant → 400 ; `from`/`to` ignorés hors `custom` (tests en 17.1).
5. Reglisser exactement la plage affichée : aucune requête (test en 17.3).

### Tâche 17.1 : API `period=custom`

**Files :** Modify `packages/shared/src/time.ts`, `apps/server/src/api/routes-stats.ts`, `apps/server/src/stats/stats-service.ts` ; Test `packages/shared/test/time.test.ts`, `apps/server/test/stats-api.test.ts`.

**Interfaces :**
- Produit :
  - `export type DayRange = { from: string; to: string }` (shared, exporté) ;
  - `Period = 'day' | 'week' | 'month' | 'all' | 'custom'` ;
  - `periodRange(period: Period, today: string, custom?: DayRange): DayRange | null` : `custom` renvoie `custom`, lève `Error('custom period needs bounds')` sans bornes ;
  - `StatsQuery.custom?: DayRange` côté serveur ; route : `period` accepte `custom`, `from`/`to` optionnels (`isRealDay`), obligatoires et `from <= to` pour `custom` (sinon 400 `invalid_payload`), ignorés sinon.

- [x] **Step 1 : tests** : shared, `periodRange('custom', '2026-11-13', { from: '2026-11-04', to: '2026-11-11' })` renvoie les bornes, sans bornes lève ; serveur, `period=custom&from=2026-09-20&to=2026-09-27` (`today` du fichier) → `range` égal aux bornes, compte les événements de la plage seulement, `days` couvre le mois de `today` ; 400 pour `to` absent, `from` après `to`, `from=2026-02-30` ; `period=day&from=…&to=…` → `range` du jour.
- [x] **Step 2 :** `pnpm --filter @app/shared exec vitest run test/time.test.ts` et `pnpm --filter @app/server exec vitest run test/stats-api.test.ts` → FAIL.
- [x] **Step 3 :** implémenter (le mois est toujours relu sauf si `period === 'month'`).
- [x] **Step 4 :** mêmes commandes → PASS.
- [x] **Step 5 : commit.** `git commit -m "Accept custom day spans in the stats API"`

### Tâche 17.2 : Glisser sur le calendrier

**Files :** Modify `apps/userscript/src/ui/details/calendar.ts`, `apps/userscript/src/ui/styles.ts` ; Test `apps/userscript/test/calendar.test.ts`.

**Interfaces :**
- Produit : `renderCalendar(doc, days, selected, onSelect, period?, onRange?: (range: DayRange) => void)`.
- Règles :
  - `pointerdown` primaire (`isPrimary`, bouton 0) sur un jour : début du glisser, `setPointerCapture` sur le calendrier si disponible ;
  - `pointermove` : jour sous le pointeur par `doc.elementFromPoint(clientX, clientY)?.closest('[data-day]')` limité à ce calendrier (sinon on garde le dernier jour) ; le cadre `.starledger-period` et les `is-in-period` sont redessinés du début au jour courant ;
  - `pointerup` sur un autre jour que le début : `onRange` avec bornes triées, et le `click` suivant est ignoré ; même jour : rien (le `click` existant sélectionne le jour) ;
  - `pointercancel` : abandon, cadre et classes de la période affichée restaurés ;
  - CSS : `.starledger-calendar{touch-action:pan-y;user-select:none;-webkit-user-select:none}`.

- [x] **Step 1 : tests** (`describe('drag')`, `elementFromPoint` simulé, événements `pointer*` créés avec `clientX/clientY/isPrimary/button`) : glisser du 4 au 11 → `onRange({ from: '…-04', to: '…-11' })` une fois et `onSelect` jamais, même après le `click` ; glisser du 11 au 4 → mêmes bornes ; pendant le glisser, le cadre couvre les colonnes 4 à 11 ; pointeur hors du calendrier (`elementFromPoint` → `document.body`) puis relâché → plage jusqu'au dernier jour survolé ; `pointercancel` → aucun appel, cadre d'origine ; pointerdown/up sur le même jour puis `click` → `onSelect` seul ; bouton droit → rien.
- [x] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/calendar.test.ts` → FAIL.
- [x] **Step 3 :** implémenter (une fonction qui peint le cadre entre deux index, partagée par le rendu initial et le glisser).
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Select a span of days by dragging over the calendar"`

### Tâche 17.3 : Période personnalisée dans le détail

**Files :** Modify `apps/userscript/src/ui/details.ts`, `apps/userscript/src/sync/api.ts`, `apps/userscript/src/i18n.ts` ; Test `apps/userscript/test/details.test.ts`, `apps/userscript/test/api.test.ts`.

**Interfaces :**
- Consomme : `DayRange`, `period=custom` (17.1), `onRange` (17.2).
- Produit :
  - `StatsQuery` client : `from?`/`to?`, omis de l'URL quand absents ;
  - état `{ period, refDay, range?: DayRange }` ; `onRange` → `{ period: 'custom', range }` (`refDay` inchangé) ; clic sur un jour ou bouton de période → `range` retiré ; flèches de mois depuis `custom` → `{ period: 'month', refDay: décalé }` ; aucune requête si période, `refDay` et bornes sont identiques ;
  - libellé : `Intl.DateTimeFormat(lang, { day, month: 'long', year }).formatRange(from, to)` (« 4–11 novembre 2026 ») ; aucun bouton de période pressé ;
  - erreur `invalid_payload` sur une requête `custom` → `t('customPeriodUnsupported')` : en « Update your Starledger server to use custom periods », fr « Mettez à jour votre serveur Starledger pour utiliser les périodes personnalisées ».

- [x] **Step 1 : tests** : `getStats` sans `from`/`to` n'a pas `from=` dans l'URL, avec les a ; glisser du 4 au 11 dans le détail → une requête `period=custom&today=<refDay>&from=…-04&to=…-11`, libellé de plage, aucun `aria-pressed="true"` dans la barre des périodes ; reglisser la même plage → aucune requête ; ‹ depuis `custom` → `period=month` sans `from` ; serveur qui répond 400 → message dédié ; clic sur un jour après → `period=day` sans `from`.
- [x] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/details.test.ts test/api.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS ; contrôle visuel du glisser sur le banc de rendu (Playwright, souris et tactile émulé).
- [x] **Step 5 : commit.** `git commit -m "Show custom day spans in the detail window"`

### Tâche 17.4 : Vérification sur le PTS (utilisateur)

- [x] Sur PC et sur téléphone : glisser sur plusieurs jours, clic simple, défilement vertical de la page avec le doigt posé sur le calendrier, flèches de mois depuis une plage.

## Scope 18 — XP et artefacts des récompenses d'anomalie

Branche : `feature/anomaly-xp-artefacts`, partie de `feature/custom-period` (chaîne #47 → #48). **Source** : un vrai message 76 du 2026-11-13 (dump de l'utilisateur, jamais copié dans le dépôt : fixtures synthétiques de même structure).

**Format relevé** (`.content-box` du message 76) :
- artefacts : un `.loot-item` de plus, `<resource-icon class="artifact …" aria-description="Artéfacts: 117">` ; le collecteur le met déjà dans `x-loot` (`resource: "artifact"`) et le parseur lève `unknown resource` ;
- XP : hors `.loot-item`, une `.loot-row > .technology-row` par forme de vie : `.lifeform-item-icon.lifeform<N>` (1 à 4) et `<span>Expérience: 621.930<span class="undermark">+4.444</span></span>` ; seul le gain (`.undermark`, nombre localisé) compte.

**Contraintes propres au scope** :
- Inconnu ≠ 0 : une observation sans `x-xp` (collecteur ancien) donne une XP inconnue, comptée à part, jamais 0.
- `PARSER_VERSION` passe à 7 ; les 76 déjà stockés sont relus par `reparse`.

**Review Focus du scope :**
1. Gain d'XP écrit `+4,444` (anglais) ou `+4.444` (français) : 4444 dans les deux cas (test en 18.1).
2. Gain illisible ou forme de vie absente : entrée `amount: null` / `lifeform: null`, XP inconnue, ressources et vaisseaux gardés (tests en 18.1 et 18.2).
3. Événement stocké avant ce scope (sans `artefacts` ni `xpByLifeform`) : stats sans `NaN`, XP comptée inconnue (test en 18.3).
4. Récompense sans XP (aucune `.technology-row`) : `x-xp` vaut `[]`, XP connue et nulle (test en 18.1).
5. Événement déjà stocké relu par le nouveau collecteur : complété (valeurs inconnues renseignées), pas de conflit ; une lecture plus pauvre le laisse intact (test serveur `ingest.test.ts`).

### Tâche 18.1 : Collecte de l'XP

**Files :** Modify `apps/userscript/src/collect/messages.ts`, `docs/ogame-data-formats.md` (§3.9, §8 point 6) ; Test `apps/userscript/test/messages.test.ts`.

**Interfaces :**
- Produit : `raw['x-xp']` sur tout message 76, JSON `{ lifeform: number | null; amount: number | null }[]`, une entrée par `.content-box .technology-row` dans l'ordre ; `lifeform` = N de la classe `lifeform<N>` ; `amount` = texte de `.undermark` si conforme à `^\+?[\d.,\s\u00a0]+$`, chiffres seuls gardés, sinon `null` ; `[]` sans ligne.

- [x] **Step 1 : tests** : HTML synthétique à deux formes de vie (`+4.444`, `+1,250`) → `[{ lifeform: 1, amount: 4444 }, { lifeform: 3, amount: 1250 }]` ; artefacts toujours dans `x-loot` ; sans `.technology-row` → `x-xp` = `[]` ; `.undermark` `+?` → `amount: null` ; icône sans classe `lifeform<N>` → `lifeform: null`.
- [x] **Step 2 :** `pnpm --filter ./apps/userscript exec vitest run test/messages.test.ts` → FAIL.
- [x] **Step 3 :** implémenter ; documenter `x-xp` et le format artefact/XP au §3.9, cocher le point du §8.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Collect lifeform experience from anomaly rewards"`

### Tâche 18.2 : Parseur

**Files :** Modify `packages/shared/src/events.ts`, `packages/shared/src/parsers/anomaly.ts`, `packages/shared/src/parsers/index.ts` (`PARSER_VERSION = 7`) ; Test `packages/shared/test/parsers/anomaly.test.ts`.

**Interfaces :**
- Produit : `AnomalyRewardEvent` gagne `artefacts: number` (somme des `resource: "artifact"`, 0 sans) et `xpByLifeform: Record<string, number> | null` (clé `String(lifeform)`, sommée ; `null` si `x-xp` absent).
- Non reconnu : `x-xp` JSON invalide ou mal formé ; une entrée à `amount` ou `lifeform` `null` rend `xpByLifeform` `null`.

- [x] **Step 1 : tests** : `artifact` 117 + métal → `artefacts: 117` ; `x-xp` à deux entrées → `xpByLifeform: { '1': 4444, '3': 1250 }` ; `x-xp` `[]` → `{}` ; sans `x-xp` → `null` ; cas non reconnus ci-dessus ; `speciesExperience` dans `x-loot` reste non reconnu.
- [x] **Step 2 :** `pnpm --filter @app/shared exec vitest run test/parsers/anomaly.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Parse artefacts and lifeform experience of anomaly rewards"`

### Tâche 18.3 : Stats et détail

**Files :** Modify `packages/shared/src/stats.ts`, `apps/userscript/src/ui/details/table.ts`, `apps/userscript/src/i18n.ts` ; Test `packages/shared/test/stats.test.ts`, `apps/userscript/test/details-table.test.ts`.

**Interfaces :**
- Produit : `StatsSummary.anomalies.rewards` gagne `artefacts: number`, `xpByLifeform: Record<string, number>`, `xpUnknown: number` (récompenses dont l'XP est `null` ou absente) ; `tiles.artefacts` et `rows.anomalies.artefacts` incluent les artefacts des récompenses (`e.artefacts ?? 0`).
- Info-bulle de la ligne Anomalies : `anomalyXp` « Rewards: XP {n} » / « Récompenses : XP {n} », `n = formatPartial(somme, xpUnknown)`, seulement si somme > 0 ou `xpUnknown > 0`.

- [x] **Step 1 : tests** : stats, une récompense à 117 artefacts → `rows.anomalies.artefacts === 117`, `tiles.artefacts` augmenté d'autant, `rows.total.artefacts === tiles.artefacts` ; XP sommée par forme de vie ; un événement sans `artefacts` ni `xpByLifeform` → `xpUnknown === 1`, aucun `NaN` ; tableau, info-bulle `Rewards: XP 17.8k` et `+ ? (1)` quand une XP est inconnue, rien sans XP.
- [x] **Step 2 :** `pnpm --filter @app/shared exec vitest run test/stats.test.ts` et `pnpm --filter ./apps/userscript exec vitest run test/details-table.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS ; le message 76 du dump, passé dans `extractMessageObservations` puis `parseObservation` hors dépôt, donne 117 artefacts et 4 × 4444 XP.
- [x] **Step 5 : commit.** `git commit -m "Show anomaly reward artefacts and experience in the detail"`

### Tâche 18.4 : Vérification sur le PTS (utilisateur)

- [x] `node dist/cli.js reparse` (PARSER_VERSION 7), puis rouvrir sur le PTS un message 76 avec XP et artefacts : l'événement est complété (artefacts et XP par forme de vie), sans conflit ; l'info-bulle de la ligne Anomalies montre l'XP.

## Scope 19 — Surplus de lithium des récompenses

Branche : `feature/lithium-bonus`. **Source** : page des anomalies d'un joueur (2026-11-16) avec la fenêtre affichée par le jeu après `collectRewards` : titre « Du lithium ! », message « Quelle heureuse trouvaille ! Vous avez récupéré un surplus de lithium dans les débris de l`anomalie : 3.273. ». C'est le `lithiumBonus` `{ title, message }` de la réponse (§9.2), que le collecteur garde déjà brut dans `lithiumBonusRaw` en marquant le montant inconnu.

**Contraintes propres au scope** : le montant est lu côté serveur depuis `lithiumBonusRaw` (relisible par `reparse`) ; aucun changement du userscript. Un message sans nombre ou avec plusieurs nombres reste inconnu, jamais 0.

**Review Focus du scope :**
1. Montant groupé `3.273` (fr) ou `3,273` (en), point final de phrase : 3273 (test en 19.1).
2. Entités ou balises HTML dans le message (`&nbsp;`, `&#160;`, `<b>`) : leurs chiffres ne comptent pas (test en 19.1).
3. JSON invalide, `message` absent ou non textuel : montant inconnu, événement gardé (test en 19.1).

### Tâche 19.1 : Montant du surplus

**Files :** Modify `packages/shared/src/parsers/anomaly-action.ts`, `packages/shared/src/parsers/index.ts` (`PARSER_VERSION = 8`), `docs/ogame-data-formats.md` (§9.2, §8 point 6) ; Test `packages/shared/test/parsers/anomaly-action.test.ts`.

**Interfaces :**
- Produit : `lithiumBonusAmount(raw: string | null): number | null` (exportée pour les tests) ; `parseAnomalyAction` donne `lithiumBonus = obs.lithiumBonus ?? lithiumBonusAmount(obs.lithiumBonusRaw)`.
- Règle : `JSON.parse(raw).message` textuel, balises et entités HTML remplacées par une espace, nombres `\d{1,3}(?:[.,\s]\d{3})+|\d+` ; exactement un nombre → sa valeur sans séparateurs, sinon `null`.

- [x] **Step 1 : tests** : message fr de la source → 3273 ; « …: 3,273. » → 3273 ; « 12 » → 12 ; message avec `&#160;` et `<b>3.273</b>` → 3273 ; deux nombres, aucun nombre, JSON invalide, `message` absent ou numérique, `raw` `null` → `null` ; `obs.lithiumBonus` 0 gardé tel quel.
- [x] **Step 2 :** `pnpm --filter @app/shared exec vitest run test/parsers/anomaly-action.test.ts` → FAIL.
- [x] **Step 3 :** implémenter ; documenter le format au §9.2 et cocher le point du §8.
- [x] **Step 4 :** même commande → PASS ; `pnpm test`, `rtk proxy pnpm lint`, `pnpm typecheck` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Read the lithium bonus amount of anomaly reward collects"`


---

## Front web et clés API multiples (scopes 20 à 24)

**Spec** : `docs/superpowers/specs/2026-11-16-web-front-design.md` (fait foi, ci-après « spec web ») ; apparence : `docs/web-design.md` et ses maquettes `docs/web-design/` (tokens, composants, rédaction, accessibilité).

**Ordre** : 20 et 21 (serveur) sont indépendants ; 22 (API du site) dépend des deux ; 23 (socle de l'app) dépend de 22 ; 24 (pages connectées et bascule) termine. Jusqu'à 24, les pages Eta restent servies : chaque scope garde le site utilisable.

**Contraintes communes :**
- Aucun appel au jeu, aucun changement du userscript ni de `/api/v1` hors `last_used_at` (spec web, non-objectifs).
- Clés API et jetons (invitation, réinitialisation) : empreinte SHA-256 seule en base, valeur affichée une fois, réponse `Cache-Control: no-store`.
- Tout jeton dans une URL (`/invite/`, `/reset/`, et leurs équivalents sous `/api/site/`) est masqué dans les logs par `redactUrl`.
- Bundle de `apps/web` produit avec `build.minify: false` ; aucune ressource externe (CDN, police, analytics).
- Toute dépendance ajoutée prend la dernière version (`npx npm-check-updates --workspaces --root`) ; une version plus ancienne gardée exprès est dite et justifiée dans la PR.
- Libellés de l'interface : FR et EN, règles de rédaction de `docs/web-design.md` (majuscule initiale seulement, pas de point final aux libellés d'une phrase).

**Review Focus (front web) :**
1. Cookie de session émis avant la migration 0004 (sans version) : toujours valable, lu comme version 0 (test en 21.1).
2. Lien de réinitialisation utilisé deux fois en parallèle : un seul succès, l'autre 410 (test en 21.1).
3. Requête JSON d'écriture sans en-tête CSRF : 403 JSON `csrf_invalid`, jamais la page d'erreur HTML (test en 22.1).
4. Jetons dans les chemins `/api/site/invitations/:token` et `/api/site/password-resets/:token` : masqués dans les logs (test en 22.2).
5. Fallback de la SPA : `/api/v1/inconnu`, `/api/site/inconnu` et `/healthz` ne renvoient jamais `index.html` (test en 24.4).

## Scope 20 — Clés API multiples

Branche : `feature/multiple-api-keys`. Spec web, « Clés API ».

### Tâche 20.1 : Plusieurs clés nommées

**Files :** Create `apps/server/src/db/migrations/0003_api_key_names.ts` ; Modify `apps/server/src/db/migrate.ts`, `apps/server/src/db/schema.ts`, `apps/server/src/auth/api-keys.ts` ; Test `apps/server/test/api-keys.test.ts`, `apps/server/test/migrations.test.ts`.

**Interfaces :**
- Migration : supprime l'index `api_keys_one_active_per_user` ; ajoute `name text` (nullable) et `last_used_at timestamptz` (nullable). `down` recrée l'index après avoir révoqué toutes les clés actives sauf la plus récente par utilisateur.
- Produit (`api-keys.ts`, remplace `generateApiKey` et `getActiveApiKey`) :
  - `export const MAX_KEY_NAME_LENGTH = 64` ;
  - `export class ApiKeyNameError extends Error` ;
  - `createApiKey(db, userId: string, name: string): Promise<{ id: string; key: string }>` : nom `trim()`, 1 à 64 caractères, sinon `ApiKeyNameError` ; ne touche à aucune autre clé ;
  - `export interface ApiKeySummary { id: string; name: string | null; prefix: string; createdAt: Date; lastUsedAt: Date | null }` ;
  - `listApiKeys(db, userId): Promise<ApiKeySummary[]>` : clés actives seulement, plus récente d'abord ;
  - `revokeApiKey(db, userId: string, keyId: string): Promise<boolean>` : `false` si la clé n'existe pas, est déjà révoquée ou appartient à un autre ; `keyId` non UUID → `false` sans requête ;
  - `authenticateApiKey` : met `last_used_at = now()` quand il est nul ou antérieur à `now() - interval '5 minutes'`, dans une seule requête `UPDATE … RETURNING user_id`.

- [x] **Step 1 : tests** : deux clés créées pour un utilisateur s'authentifient toutes deux ; en révoquer une laisse l'autre valable ; `revokeApiKey` sur la clé d'un autre → `false` et la clé reste valable ; `'not-a-uuid'` → `false` ; nom `'  PC  '` stocké `'PC'` ; `''`, `'   '`, 65 caractères → `ApiKeyNameError` ; `listApiKeys` exclut les révoquées, ordre décroissant ; `last_used_at` nul → posé à l'authentification ; posé à `now() - 1 min` → inchangé ; à `now() - 6 min` → mis à jour. Migration : une clé active créée avant 0003 reste valable avec `name` nul.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run test/api-keys.test.ts test/migrations.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Allow several named API keys per user"`

### Tâche 20.2 : Page compte Eta provisoire

Les pages Eta disparaissent au scope 24 ; on les adapte au minimum pour que les clés multiples servent dès maintenant.

**Files :** Modify `apps/server/src/web/routes-account.ts`, `apps/server/src/web/views/account.eta`, `apps/server/src/web/locales/{fr,en}.json` ; Test `apps/server/test/api-keys.test.ts` (partie web) ou `apps/server/test/web-auth.test.ts`, selon où sont les tests actuels de `/account/api-key`.

**Interfaces :**
- Routes : `POST /account/api-keys` (champ `name`) remplace `/account/api-key` ; `POST /account/api-keys/:id/revoke` remplace `/account/api-key/revoke` (clé inconnue ou d'un autre → page 404). Nom invalide → page compte en 400 avec `account.keyNameInvalid`.
- Page : formulaire nom + « Créer une clé », clé créée affichée une fois, tableau nom (« Sans nom » si nul), préfixe, création, dernière utilisation (« jamais »), bouton révoquer par ligne.

- [x] **Step 1 : tests** : créer deux clés via le formulaire → les deux listées ; révoquer la première → seule la seconde listée ; révoquer l'id d'un autre utilisateur → 404 ; nom vide → 400 ; sans CSRF → 403.
- [x] **Step 2 :** lancer le fichier de test → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** `pnpm test`, `rtk proxy pnpm lint`, `pnpm typecheck` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Manage several API keys from the account page"`

## Scope 21 — Mots de passe

Branche : `feature/passwords`. Spec web, « Mots de passe ».

### Tâche 21.1 : Changement, réinitialisation et version de session

**Files :** Create `apps/server/src/db/migrations/0004_password_resets.ts`, `apps/server/src/auth/tokens.ts`, `apps/server/src/users/passwords.ts` ; Modify `apps/server/src/db/migrate.ts`, `apps/server/src/db/schema.ts`, `apps/server/src/users/invitations.ts` (utilise `tokens.ts`), `apps/server/src/web/auth.ts` ; Test `apps/server/test/passwords.test.ts`, `apps/server/test/web-auth.test.ts`.

**Interfaces :**
- Migration : `users.session_version integer not null default 0` ; table `password_resets` (`id uuid pk`, `user_id uuid not null → users`, `token_hash text not null unique`, `created_by uuid not null → users`, `expires_at timestamptz not null`, `used_at timestamptz`, `created_at timestamptz not null default now()`).
- `tokens.ts` : `newToken(): { token: string; hash: string }` (32 octets base64url) et `hashToken(token: string): string`, repris d'`invitations.ts`.
- `passwords.ts` :
  - `export class CurrentPasswordError extends Error` ; `export class PasswordResetError extends Error` (« unknown, expired or already used ») ; `export class UnknownUserError extends Error` ;
  - `changePassword(db, userId, current: string, next: string): Promise<{ sessionVersion: number }>` : `current` faux → `CurrentPasswordError` ; `next` trop court → `UserInputError('password_short')` ; sinon nouveau hash et `session_version + 1` ;
  - `setPassword(db, userId, next): Promise<{ sessionVersion: number }>` : même règle de longueur, `session_version + 1` (sert à la CLI et à la réinitialisation) ;
  - `createPasswordReset(db, adminId, username: string, publicUrl: string, ttlHours = 24): Promise<{ url: string; username: string }>` : identifiant normalisé comme `createUser` ; inconnu → `UnknownUserError` ; les liens encore ouverts de ce compte passent `expires_at = now()` ; URL `${publicUrl}/reset/${token}` ;
  - `getPasswordReset(db, token): Promise<{ username: string } | null>` ;
  - `consumePasswordReset(db, token, password: string): Promise<{ user: User; sessionVersion: number }>` : réclamation par `UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING` dans une transaction (comme `consumeInvitation`), sinon `PasswordResetError` ; mot de passe trop court → `UserInputError` et le lien reste utilisable (rollback).
- `web/auth.ts` : `startSession(request, userId, sessionVersion: number)` stocke `sessionVersion` ; `loadUser` lit `session_version` et supprime la session si la version du cookie diffère ; **cookie sans `sessionVersion` = version 0**. Tous les appelants actuels de `startSession` passent la version lue en base.

- [x] **Step 1 : tests** (`passwords.test.ts`) : changement réussi → l'ancien mot de passe échoue à `verifyCredentials`, le nouveau passe, version +1 ; mauvais mot de passe actuel → `CurrentPasswordError`, rien ne change ; nouveau de 11 caractères → `UserInputError` ; réinitialisation : lien créé pour `'  Vega '` → `username` `'vega'` ; inconnu → `UnknownUserError` ; second lien → le premier renvoie `null` à `getPasswordReset` ; consommation → nouveau mot de passe valable, version +1, ancien mot de passe valable jusque-là ; deux `consumePasswordReset` en parallèle → un succès, un `PasswordResetError` ; lien expiré (`expires_at` dans le passé) → `PasswordResetError` ; mot de passe trop court → erreur puis le lien marche encore. `web-auth.test.ts` : session ouverte, puis `setPassword` → requête suivante redirigée vers `/login` ; cookie forgé sans `sessionVersion` pour un utilisateur en version 0 → accepté.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run test/passwords.test.ts test/web-auth.test.ts test/invitations.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add password change, admin reset links and session versions"`

### Tâche 21.2 : Commande `reset-password` et logs

**Files :** Modify `apps/server/src/cli.ts`, `apps/server/src/web/routes-auth.ts` (`redactUrl`), `docs/deploy.md` ; Test `apps/server/test/cli.test.ts` (ou le fichier qui teste `create-admin`), `apps/server/test/web-auth.test.ts`.

**Interfaces :**
- `node dist/cli.js reset-password --username <name>` : mot de passe lu comme `create-admin` (`readPassword`), `setPassword`, sortie `Password of "<username>" reset\n`, code 0 ; inconnu → `Error: Unknown user "<name>"`, code 1 ; ajouté à `USAGE` et au filtre de `main()`.
- `redactUrl` masque `/invite/<t>`, `/reset/<t>`, `/api/site/invitations/<t>` et `/api/site/password-resets/<t>` (en préparation du scope 22).
- `docs/deploy.md` : section « Reset a password » (commande et lien admin).

- [x] **Step 1 : tests** : CLI avec stdin `'new-password-123\n'` → code 0 et `verifyCredentials` passe ; utilisateur inconnu → code 1 ; mot de passe court → code 1 ; `redactUrl` sur les quatre formes → `[redacted]`, querystring conservée hors jeton.
- [x] **Step 2 :** lancer les fichiers de test → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** `pnpm test`, `rtk proxy pnpm lint`, `pnpm typecheck` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the reset-password command and redact reset tokens"`

## Scope 22 — API JSON du site

Branche : `feature/site-api`. Spec web, « Architecture ».

**Conventions :**
- Préfixe `/api/site`, plugin Fastify enregistré **dans** `webRoutes` (après le hook `loadUser`), avec ses propres `setErrorHandler`/`setNotFoundHandler` JSON.
- Erreurs : `{ "error": <code> }`, codes : `unauthenticated` (401), `forbidden` (403), `csrf_invalid` (403), `not_found` (404), `rate_limited` (429), `invalid_payload` (400), `server_error` (500), plus les codes métier de chaque route.
- CSRF : `@fastify/csrf-protection` existant ; le jeton est renvoyé par `GET /api/site/session` et lu dans l'en-tête `x-csrf-token` (lecture par défaut du plugin). Toute méthode autre que `GET` l'exige.
- Dates en ISO 8601. Réponses contenant un secret : `Cache-Control: no-store`.
- Contrats zod dans `packages/shared/src/site.ts` (exporté par `index.ts`), utilisés par le serveur pour valider et par l'app pour typer.

### Tâche 22.1 : Socle, session, connexion

**Files :** Create `packages/shared/src/site.ts`, `apps/server/src/site/plugin.ts`, `apps/server/src/site/routes-session.ts` ; Modify `packages/shared/src/index.ts`, `apps/server/src/app.ts` ; Test `apps/server/test/site-session.test.ts`.

**Interfaces :**
- Shared : `siteUserSchema` (`{ username, isAdmin, locale: 'fr' | 'en' }`), `sessionResponseSchema` (`{ user: SiteUser | null; locale: 'fr' | 'en'; csrfToken: string; openSignup: boolean }`), `loginRequestSchema` (`{ username: string; password: string }`), `SiteErrorCode` (union des codes), types inférés exportés.
- Routes : `GET /session` (locale = `user.locale` sinon `negotiateLocale`) ; `POST /login` (10/min/IP, `invalid_credentials` 401, sinon `startSession` et `{ user }`) ; `POST /logout` → 204 et session supprimée.

- [x] **Step 1 : tests** : `GET /session` anonyme → `user: null`, `csrfToken` non vide, `locale` d'`Accept-Language: fr` = `fr` ; login correct avec jeton → `{ user }` et cookie, puis `GET /session` connecté ; mauvais mot de passe → 401 `invalid_credentials` ; login sans `x-csrf-token` → 403 `csrf_invalid` en JSON ; 11ᵉ tentative dans la minute → 429 `rate_limited` ; corps non conforme → 400 `invalid_payload` ; `GET /api/site/nope` → 404 JSON ; logout → 204 puis `user: null`.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run test/site-session.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the site JSON API with session and login"`

### Tâche 22.2 : Inscription, invitations, réinitialisation

**Files :** Create `apps/server/src/site/routes-public.ts` ; Modify `packages/shared/src/site.ts`, `apps/server/src/site/plugin.ts` ; Test `apps/server/test/site-public.test.ts`.

**Interfaces :**
- Shared : `signupRequestSchema` (`{ username, password }`), `resetInfoResponseSchema` (`{ username }`), `resetRequestSchema` (`{ password }`).
- Routes (10/min/IP pour les `POST`) :
  - `GET /invitations/:token` → 204 ou 410 `invitation_invalid` ; `POST /invitations/:token` → 201 `{ user }` et session, 410 `invitation_invalid`, 400 `username_invalid` | `password_short` | `username_taken` ;
  - `POST /signup` (seulement si `openSignup`, sinon 404) → mêmes réponses sans 410 ;
  - `GET /password-resets/:token` → `{ username }` ou 410 `reset_invalid` ; `POST /password-resets/:token` → 200 `{ user }` et session ouverte avec la nouvelle version, 410 `reset_invalid`, 400 `password_short`.

- [x] **Step 1 : tests** : parcours invitation complet ; jeton déjà utilisé → 410 ; `/signup` 404 quand `openSignup` est faux, 201 quand vrai ; réinitialisation : `GET` donne l'identifiant, `POST` ouvre une session, une autre session ouverte avant devient anonyme, réutilisation → 410 ; les logs capturés (`logStream`) ne contiennent jamais le jeton en clair pour les quatre routes.
- [x] **Step 2 :** lancer le fichier → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add signup, invitation and password reset to the site API"`

### Tâche 22.3 : Compte, réglages, administration

**Files :** Create `apps/server/src/site/routes-account.ts`, `apps/server/src/site/routes-admin.ts` ; Modify `packages/shared/src/site.ts`, `apps/server/src/settings/settings.ts` (validation partagée), `apps/server/src/site/plugin.ts` ; Test `apps/server/test/site-account.test.ts`, `apps/server/test/site-admin.test.ts`.

**Interfaces :**
- Shared : `apiKeySummarySchema` (`{ id, name: string | null, prefix, createdAt, lastUsedAt: string | null }`), `createKeyRequestSchema` (`{ name }`), `createKeyResponseSchema` (`{ id, key }`), `changePasswordRequestSchema` (`{ current, next }`), `valuationSettingsSchema` (bornes actuelles : MSU 0,01 à 100, ratios entiers 0 à 100 ; `parseValuationForm` s'appuie dessus), `universeSettingsSchema` (`{ serverId, lang, settings }`), `createResetRequestSchema` (`{ username }`), `linkResponseSchema` (`{ url }`), `resetLinkResponseSchema` (`{ url, username }`).
- Routes connectées (401 sinon) :
  - `GET /api-keys` → `{ keys }` ; `POST /api-keys` → 201 `{ id, key }` (no-store), 400 `name_invalid` ; `DELETE /api-keys/:id` → 204 ou 404 ;
  - `POST /password` (10/min/utilisateur) → 204 et cookie mis à jour avec la nouvelle version, 400 `current_invalid` | `password_short` ;
  - `GET /settings` → `{ universes }` (univers de `accounts`, ordre serveur puis langue) ; `PUT /settings/:serverId/:lang` → 200 `{ settings }`, 400 `settings_invalid`, 404 si l'univers n'est pas à l'utilisateur ou les paramètres sont mal formés (mêmes contrôles que la route Eta) ;
- Routes admin (403 `forbidden` sinon) : `POST /admin/invitations` → 201 `{ url }` ; `POST /admin/password-resets` → 201 `{ url, username }`, 404 `unknown_user`.

- [x] **Step 1 : tests** : clés : créer, lister, supprimer, supprimer celle d'un autre → 404 ; changement de mot de passe : la session courante reste connectée, une seconde session devient anonyme, mauvais actuel → 400 `current_invalid` ; réglages : lecture, écriture valide relue, `msuRatio` à 0 → 400, univers d'un autre → 404, `serverId` `abc` → 404 ; admin : non-admin → 403, invitation et lien de réinitialisation créés, identifiant inconnu → 404 ; anonyme sur chaque route → 401.
- [x] **Step 2 :** lancer les fichiers → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add account, settings and admin endpoints to the site API"`

## Scope 23 — App web : socle et pages publiques

Branche : `feature/web-app`. Spec web, « Architecture », « Apparence », « Langue » ; `docs/web-design.md`.

### Tâche 23.1 : Paquet `apps/web`, thème et build

**Files :** Create `apps/web/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,index.html}`, `apps/web/src/{main.tsx,app.tsx,styles.css}` ; Modify `biome.json` (`**/*.tsx`), `.gitignore` si besoin ; Test `apps/web/test/app.test.tsx`.

**Interfaces :**
- `@app/web` : React, React DOM, React Router, Tailwind CSS v4 (`@tailwindcss/vite`), `@vitejs/plugin-react` ; tests Vitest en `jsdom` avec Testing Library (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`). Scripts `dev`, `build`, `test`, `typecheck`. Dépend de `@app/shared` (`workspace:*`).
- `vite.config.ts` : `build: { minify: false, outDir: 'dist' }` ; `server.proxy['/api'] = 'http://localhost:3000'`.
- `styles.css` : `@import "tailwindcss";` puis `@theme` avec **toutes** les variables `:root` de `docs/web-design/starledger.css` (couleurs, rayons, polices, `--ease`) ; CSS hors utilitaires listé dans `docs/web-design.md` § Implémentation (fiches des clés au téléphone, résumé des `<details>` ouverts, marqueur du `<summary>`).
- `app.tsx` : `<App />` avec le routeur ; routes vides pour l'instant, page introuvable par défaut.

- [x] **Step 1 : test** : `render(<App />)` sur `/nope` affiche le titre de la page introuvable.
- [x] **Step 2 :** `pnpm --filter @app/web test` → FAIL.
- [x] **Step 3 :** créer le paquet (dépendances à la dernière version via `npx npm-check-updates`), le thème et le routeur.
- [x] **Step 4 :** `pnpm --filter @app/web test`, `pnpm --filter @app/web build` → PASS ; `wc -l apps/web/dist/assets/*.js` donne des milliers de lignes (bundle non minifié) ; `pnpm test:coverage` inclut `apps/web`.
- [x] **Step 5 : commit.** `git commit -m "Scaffold the web app with Vite, React and the Tailwind theme"`

### Tâche 23.2 : Client API, session, langue

**Files :** Create `apps/web/src/api.ts`, `apps/web/src/session.tsx`, `apps/web/src/i18n.ts`, `apps/web/src/locales/{fr,en}.json` ; Test `apps/web/test/api.test.ts`, `apps/web/test/session.test.tsx`.

**Interfaces :**
- `api.ts` : `class ApiError extends Error { status: number; code: SiteErrorCode | 'network' }` ; `apiFetch<T>(path: string, init?: { method?: string; body?: unknown; schema?: ZodType<T> }): Promise<T>` : préfixe `/api/site`, JSON, `credentials: 'same-origin'`, en-tête `x-csrf-token` (jeton tenu par `setCsrfToken(token)`), 204 → `undefined`, réponse non OK → `ApiError` avec le code du corps.
- `session.tsx` : `SessionProvider` charge `GET /session` au montage, expose `useSession(): { user: SiteUser | null; locale; openSignup; unavailable; refresh(): Promise<void> }` ; `RequireUser` (redirige vers `/login`) et `RequireAdmin` (page Erreur « accès interdit ») vivent dans `apps/web/src/guards.tsx` pour éviter un import circulaire avec les pages.
- `i18n.ts` : `t(key, params?)` comme `apps/server/src/web/i18n.ts` (même syntaxe `{param}`), catalogues repris des locales serveur et complétés des libellés des maquettes ; `useT()` lit la langue de la session ; `formatDate(date, locale)` → « 16 nov. 2026, 14:32 » en fr.

- [x] **Step 1 : tests** : `apiFetch` envoie le jeton, transforme `{ error: 'csrf_invalid' }` 403 en `ApiError('csrf_invalid', 403)`, 204 → `undefined`, panne réseau → code `network` ; `SessionProvider` anonyme : `RequireUser` redirige vers `/login` ; `t('settings.universe', { serverId: '285', lang: 'fr' })` → « Univers 285 (fr) » ; clé absente → la clé ; `formatDate` fr et en.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** lancer → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the web API client, session and translations"`

### Tâche 23.3 : Composants

**Files :** Create `apps/web/src/ui/{button.tsx,field.tsx,card.tsx,notice.tsx,alert.tsx,icons.tsx,auth-card.tsx}` ; Test `apps/web/test/ui.test.tsx`.

**Interfaces :** un composant par entrée de `docs/web-design.md` § Composants, avec les états qu'il décrit :
- `Button({ variant: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; block?: boolean })` ;
- `Field({ label, hint?, error?, ...inputProps })` : `aria-describedby` vers l'indication ou l'erreur, `aria-invalid` si erreur ;
- `Card({ title, subtitle?, children })` ; `Alert({ children })` (`role="alert"`) ;
- `SecretNotice({ message, secret })` (`role="status"`) : secret en mono, `user-select: all` ; bouton « Copier » rendu seulement si `navigator.clipboard` existe, passe à « Copié » après succès ; refus du presse-papiers → bouton revenu à « Copier », secret toujours sélectionnable ;
- `AuthCard({ title, children })` : carte de 400 px centrée avec « Starledger ».

- [x] **Step 1 : tests** : `Field` avec erreur → `aria-invalid="true"` et message relié ; `SecretNotice` sans `navigator.clipboard` → pas de bouton ; avec → clic appelle `writeText(secret)` puis « Copié » ; `writeText` rejeté → « Copier » ; `Alert` a `role="alert"`.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter avec les utilitaires du thème ; aucun style propre aux écrans.
- [x] **Step 4 :** lancer → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the web UI components"`

### Tâche 23.4 : Pages publiques

**Files :** Create `apps/web/src/pages/{login.tsx,signup.tsx,reset-password.tsx,error.tsx}` ; Modify `apps/web/src/app.tsx` ; Test `apps/web/test/public-pages.test.tsx`.

**Interfaces :**
- Routes : `/login`, `/signup` (seulement si `openSignup`, sinon page introuvable), `/invite/:token` (vérifie le jeton au montage, 410 → page Erreur « invitation invalide »), `/reset/:token` (« Compte : <identifiant> », 410 → page Erreur), page Erreur / introuvable.
- Après connexion, inscription ou réinitialisation : `refresh()` puis navigation vers `/account`. Utilisateur déjà connecté sur `/login` → `/account`.
- Erreurs d'API rendues selon les maquettes : `invalid_credentials` en alerte ; `username_*` et `password_short` sous le champ concerné.

- [x] **Step 1 : tests** (fetch simulé) : login invalide → alerte « Identifiants invalides » ; login valide → navigation `/account` ; invitation expirée → page Erreur ; `username_taken` → erreur sous Identifiant ; reset affiche « Compte : vega » et soumet `{ password }` ; `/signup` avec `openSignup: false` → introuvable.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter d'après les maquettes `login`, `signup`, `reset-password`.
- [x] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS ; contrôle visuel bureau (1280 px) et téléphone (390 px) contre `docs/web-design/screenshots/` avec `pnpm --filter @app/web dev` et le serveur local.
- [x] **Step 5 : commit.** `git commit -m "Add the public pages of the web app"`

## Scope 24 — Pages connectées et bascule

Branche : `feature/web-switchover`.

### Tâche 24.1 : En-tête et page Compte

**Files :** Create `apps/web/src/ui/app-shell.tsx`, `apps/web/src/pages/account.tsx` ; Modify `apps/web/src/app.tsx` ; Test `apps/web/test/account.test.tsx`.

**Interfaces :**
- `AppShell` : « Starledger », menu Compte, Réglages, Administration (admin seulement), `aria-current="page"` sur l'onglet actif, identifiant et « Déconnexion » (`POST /logout` puis `/login`). Pas d'onglet Dashboard (spec web, non-objectifs). `/` redirige vers `/account`.
- Compte : carte « Clés API » (formulaire nom, `SecretNotice` de la clé créée, tableau, « Révoquer » par ligne, état vide) et carte « Mot de passe » (actuel, nouveau, champ identifiant caché `autocomplete="username"`).

- [x] **Step 1 : tests** : liste des clés rendue, « Sans nom » et « jamais » ; créer → `SecretNotice` avec la clé et ligne ajoutée ; nom vide → erreur sous le champ ; révoquer → ligne retirée ; aucune clé → « Aucune clé API active » ; mot de passe actuel faux → alerte « Mot de passe actuel incorrect » ; non-admin → pas d'onglet Administration.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter d'après `account.html`.
- [x] **Step 4 :** lancer → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the account page of the web app"`

### Tâche 24.2 : Page Réglages

**Files :** Create `apps/web/src/pages/settings.tsx` ; Test `apps/web/test/settings.test.tsx`.

**Interfaces :** une carte `<details>` par univers ; `open` sur l'univers en erreur, celui qu'on vient d'enregistrer, ou l'unique univers ; résumé fermé « MSU 3 : 2 : 1 · Expéditions 100 % · Anomalies 100 % » (format fr des nombres) ; ratios MSU avec pastilles ; `PUT` à l'enregistrement ; `settings_invalid` → alerte en tête de la carte ; aucun univers → texte `settings.none`.

- [x] **Step 1 : tests** : un seul univers ouvert d'office ; deux univers fermés au départ, résumé avec virgule décimale (`2,5`) ; enregistrement invalide → alerte et carte ouverte ; enregistrement valide → carte ouverte avec les nouvelles valeurs ; aucun univers → texte vide.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter d'après `settings.html`.
- [x] **Step 4 :** lancer → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the settings page of the web app"`

### Tâche 24.3 : Page Administration

**Files :** Create `apps/web/src/pages/admin.tsx` ; Test `apps/web/test/admin.test.tsx`.

**Interfaces :** route `/admin` sous `RequireAdmin` ; carte « Invitations » (bouton, puis `SecretNotice` du lien, 72 h) ; carte « Réinitialiser un mot de passe » (champ « Identifiant Starledger », bouton « Créer un lien », `SecretNotice` nommant le compte, 24 h ; `unknown_user` → « Aucun compte avec cet identifiant » sous le champ).

- [x] **Step 1 : tests** : invitation créée → lien affiché ; lien de réinitialisation → message avec l'identifiant ; identifiant inconnu → erreur de champ ; non-admin sur `/admin` → page Erreur.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter d'après `admin.html`.
- [x] **Step 4 :** lancer → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the admin page of the web app"`

### Tâche 24.4 : Le serveur sert l'app, les pages Eta disparaissent

**Files :** Modify `apps/server/src/app.ts`, `apps/server/package.json` (retire `@fastify/view`, `eta`, `@fastify/formbody` ; ajoute `@fastify/static`), `apps/server/tsdown.config.ts` (plus de copie des vues), `Dockerfile` (construit `@app/web`, copie `apps/web/dist` vers `/app/public`), `.github/workflows/ci.yml` (le contrôle des vues devient : `test -f apps/web/dist/index.html`), `docs/deploy.md`, `README.md` ; Delete `apps/server/src/web/views/`, `apps/server/src/web/routes-{account,invite}.ts`, les routes HTML de `routes-auth.ts`, `apps/server/src/web/locales/` (garder `negotiateLocale`) ; Test `apps/server/test/web-static.test.ts`, tests web existants portés vers l'API du site ou supprimés s'ils doublonnent les tests 22.x.

**Interfaces :**
- `buildApp(config, db, options: { …; webRoot?: string })` : `webRoot` par défaut `fileURLToPath(new URL('../public', import.meta.url))` ; dossier absent → pas de service statique et un avertissement au démarrage.
- Fichiers de `webRoot/assets/` : `Cache-Control: public, max-age=31536000, immutable` ; `index.html` : `no-cache`.
- Fallback : `GET` hors `/api/` et hors `/healthz`, sans fichier correspondant → `index.html` (200). `GET /admin/invitations` → 301 vers `/admin`.
- Les 404 sous `/api/v1` et `/api/site` restent du JSON.

- [x] **Step 1 : tests** (`webRoot` = dossier temporaire avec `index.html` et `assets/a.js`) : `/`, `/account`, `/invite/abc` → `index.html` ; `/assets/a.js` → le fichier avec le cache immuable ; `/api/v1/nope` et `/api/site/nope` → 404 JSON ; `/healthz` → JSON ; `/admin/invitations` → 301 `/admin` ; `POST /login` (ancienne route HTML) → 404.
- [x] **Step 2 :** lancer → FAIL.
- [x] **Step 3 :** implémenter, supprimer Eta et ses dépendances, porter les tests.
- [x] **Step 4 :** `pnpm test:coverage`, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS ; `docker compose up -d --build app` puis parcours complet sur `http://127.0.0.1:3000` : connexion, clé créée puis révoquée, réglages enregistrés, invitation, lien de réinitialisation, changement de mot de passe ; captures bureau et téléphone comparées à `docs/web-design/screenshots/` (Playwright isolé).
- [x] **Step 5 : commit.** `git commit -m "Serve the web app and drop the server-rendered pages"`

### Tâche 24.5 : Vérification (utilisateur)

- [x] Sur le serveur local : créer une clé pour le téléphone sans toucher à celle du PC ; le userscript des deux appareils synchronise toujours ; la dernière utilisation de chaque clé se met à jour.

---

## Dashboard web (scopes 25 à 27)

**Spec** : `docs/superpowers/specs/2026-11-17-web-dashboard-design.md` (fait foi, ci-après « spec dashboard ») ; apparence : `docs/web-design.md` (tokens, graphiques, rédaction, accessibilité) et la maquette indicative `docs/web-design/mockups/dashboard.html`.

**Ordre** : 25 (API) puis 26 (page). 27 (en-têtes de sécurité) est indépendant et peut passer avant ou après.

**Contraintes communes :**
- Aucun nouveau calcul de stats : tout chiffre vient de `computeStats` via `getStats` ; le front ne fait que mettre en forme (spec dashboard, non-objectifs).
- Aucun changement de `/api/v1` ni du userscript.
- Inconnu ≠ 0 : un carburant inconnu ou un rapport non reconnu est signalé, jamais affiché comme 0.
- Unités jamais additionnées entre elles, sauf la valorisation libellée « MSU ».
- Graphiques : Recharts, sans animation (`isAnimationActive={false}`), couleurs des tokens, axes en mono `muted`, chaque graphique dans un conteneur `role="img"` avec un `aria-label` qui résume ses données.
- Bundle non minifié, aucune ressource externe ; dépendance à la dernière version (`npx npm-check-updates --workspaces --root`) et `pnpm audit` sans alerte haute.

**Review Focus (dashboard) :**
1. Compte d'un autre utilisateur passé dans l'URL ou en paramètre de `/api/site/stats` : réponse vide, aucune donnée de l'autre (test en 25.2).
2. `account` absent, mal formé ou plus suivi dans l'URL : premier compte de la liste, pas d'écran blanc (test en 26.2).
3. Période sans aucun événement : chaque carte affiche « Aucune donnée sur cette période », pas un graphique vide ni des 0 (test en 26.3 et 26.4).
4. Réponse de stats arrivée après un changement de compte plus récent : l'ancienne réponse n'écrase pas la nouvelle (test en 26.2).
5. Nom de joueur contenant du HTML (`<b>x</b>`) : affiché tel quel en texte (test en 26.2).

## Scope 25 — API du dashboard

Branche : `feature/dashboard-api`. Spec dashboard, « Serveur » et « Sécurité ».

### Tâche 25.1 : `no-store` sur toute l'API du site

**Files :** Modify `apps/server/src/site/plugin.ts`, `apps/server/src/site/http.ts` (`noStore` devient inutile : le retirer des routes) ; Test `apps/server/test/site-security.test.ts`.

**Interfaces :** un hook `onSend` dans `sitePlugin` pose `Cache-Control: no-store` sur toute réponse de `/api/site`, erreurs comprises.

- [x] **Step 1 : test** : `GET /api/site/session`, `GET /api/site/api-keys` (connecté), `GET /api/site/nope` et un `POST` sans CSRF répondent tous avec `cache-control: no-store`.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run --no-file-parallelism test/site-security.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Never cache site API responses"`

### Tâche 25.2 : Comptes et stats pour le site

**Files :** Create `apps/server/src/site/routes-stats.ts`, `apps/server/src/stats/stats-query.ts` ; Modify `apps/server/src/api/routes-stats.ts` (importe le schéma déplacé), `apps/server/src/site/plugin.ts`, `packages/shared/src/site.ts` ; Test `apps/server/test/site-stats.test.ts`.

**Interfaces :**
- `stats-query.ts` : `export const statsQuerySchema` (déplacé tel quel de `api/routes-stats.ts`) et `export function toStatsQuery(data): StatsQuery` (la conversion `from`/`to` → `custom` aujourd'hui dans la route).
- `packages/shared/src/site.ts` : `siteAccountSchema = z.object({ serverId: z.number(), lang: z.string(), playerId: z.number(), playerName: z.string().nullable() })`, `accountsResponseSchema = z.object({ accounts: z.array(siteAccountSchema) })`.
- `GET /api/site/accounts` (session) : comptes de l'utilisateur, triés `server_id`, `lang`, `player_id`.
- `GET /api/site/stats` (session) : même requête et même réponse (`StatsResponse`) que `GET /api/v1/stats` ; paramètre invalide → 400 `invalid_payload` ; limite `API_RATE_LIMIT_PER_MINUTE` par utilisateur.

- [x] **Step 1 : tests** : `accounts` liste les deux comptes de Vega triés, `playerName` nul conservé, sans ceux d'Orion ; anonyme → 401 ; `stats` d'un compte de Vega, période `month`, renvoie le même corps que `/api/v1/stats` avec la clé de Vega (hors `generatedAt`) ; Orion demandant le compte de Vega → résumé vide (`expeditions.count` 0) ; `period=year`, `today=2026-02-31`, `serverId=abc` → 400 `invalid_payload` ; la requête n° `API_RATE_LIMIT_PER_MINUTE + 1` → 429 `rate_limited`.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run --no-file-parallelism test/site-stats.test.ts test/stats-api.test.ts` → FAIL.
- [x] **Step 3 :** implémenter ; `/api/v1/stats` garde son comportement.
- [x] **Step 4 :** même commande → PASS ; suite serveur complète, `rtk proxy pnpm lint`, `pnpm typecheck` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Serve accounts and stats to the web app"`

## Scope 26 — Page Dashboard

Branche : `feature/web-dashboard`. Spec dashboard, « Sélection du compte et de la période », « Les blocs », « Formats ».

### Tâche 26.1 : Recharts et outils de mise en forme

**Files :** Modify `apps/web/package.json`, `apps/web/src/i18n.ts`, `apps/web/src/styles.css`, `apps/web/src/locales/{fr,en}.json`, `apps/web/test/setup.ts` ; Create `apps/web/src/dashboard/format.ts` ; Test `apps/web/test/dashboard-format.test.ts`.

**Interfaces :**
- Dépendance `recharts` (dernière version, `pnpm audit`).
- `test/setup.ts` : un `ResizeObserver` minimal et une taille fixe pour `ResponsiveContainer`, afin que Recharts dessine sous jsdom.
- `formatCompact(value: number, locale: SiteLocale): string` dans `i18n.ts` : une décimale, unités k, M, G, séparateur de la langue, signe moins typographique (`−`) ; 0 → « 0 ».
- `styles.css` : couleurs des résultats d'expédition en tokens `--color-outcome-<résultat>` (valeurs de `apps/userscript/src/ui/details/donut.ts`).
- `dashboard/format.ts` : `parseAccountKey(raw: string | null): { serverId: number; lang: string; playerId: number } | null` (`^(\d{1,10})-([a-z]{2,3})-(\d{1,16})$`), `accountKey(a)`, `shiftDay(day: string, period: 'day' | 'week' | 'month' | 'all', delta: 1 | -1): string`, `periodTitle(t, locale, period, day): string`.
- Catalogues : `nav.dashboard`, `dashboard.*` (titres des blocs, résultats d'expédition et catégories repris du userscript, noms des 17 vaisseaux 202 à 219 en fr et en, textes vides et bandeau).

- [x] **Step 1 : tests** : `formatCompact(30_612_345, 'fr')` → `30,6 M` ; `(-2_000_000, 'fr')` → `−2 M` ; `(950, 'en')` → `950` ; `(1_250, 'en')` → `1.3k` ; `parseAccountKey('285-fr-123')` → `{ 285, 'fr', 123 }` ; `'285-FR-1'`, `'x'`, `null` → `null` ; `shiftDay('2026-01-31', 'month', 1)` → `2026-02-28` ; `('2026-11-17', 'week', -1)` → `2026-11-10` ; `periodTitle` fr : month → « Novembre 2026 », week → « Semaine du 16 nov. 2026 », all → « Tout l'historique ».
- [x] **Step 2 :** `pnpm --filter @app/web exec vitest run test/dashboard-format.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add Recharts and the dashboard formatting helpers"`

### Tâche 26.2 : Page, sélection et chiffres clés

**Files :** Create `apps/web/src/pages/dashboard.tsx`, `apps/web/src/dashboard/use-dashboard.ts`, `apps/web/src/dashboard/key-figures.tsx` ; Modify `apps/web/src/app.tsx`, `apps/web/src/ui/app-shell.tsx` (onglet Dashboard en premier ; `Page` accepte `wide`), `apps/web/src/pages/{login,signup,reset-password}.tsx` (arrivée sur `/dashboard`) ; Test `apps/web/test/dashboard.test.tsx`, tests existants qui attendent `/account` après connexion.

**Interfaces :**
- Route `/dashboard` sous `RequireUser` ; `/` → `/dashboard`.
- `useDashboard()` : lit et écrit `account`, `period` (`day` | `week` | `month` | `all`, défaut `month`), `day` (défaut : date locale du navigateur) dans l'URL ; charge `/accounts` une fois, puis `/stats` à chaque changement en ignorant les réponses périmées ; mémorise le dernier compte choisi (`localStorage`, clé `starledger.dashboardAccount`, lecture et écriture dans un `try`).
- En-tête de page : titre `periodTitle`, sélecteur « Univers 285 (fr) · Orion » (« Joueur 123 » sans nom), boutons Jour, Semaine, Mois, Tout (`aria-pressed`), flèches ‹ › (`aria-label` « Période précédente » / « Période suivante »).
- `KeyFigures({ summary })` : métal, cristal, deutérium, antimatière, artefacts, bilan MSU signé, carburant (« + N départs inconnus » si `fuel.unknownCount > 0`).
- Bandeau de données partielles : `counts.unrecognized` (libellé « dans tout l'historique »), `summary.conflictCount`, `fuel.unknownCount`, affiché seulement si l'un est non nul.

- [x] **Step 1 : tests** : connexion → `/dashboard` ; `/` → `/dashboard` ; onglet Dashboard `aria-current` ; sans `account`, le premier compte est choisi et l'URL le porte ; `account=999-fr-1` (inconnu) → premier compte ; choisir le second compte → `GET /stats?serverId=…` du second et URL mise à jour ; deux réponses dans le désordre (la première retardée) → les chiffres du second compte restent ; ‹ en Mois depuis `2026-11-17` → `day=2026-10-17` et titre « Octobre 2026 » ; aucun compte → texte vide, aucun appel `/stats` ; `fuel.unknownCount` 3 → « + 3 départs inconnus » ; bandeau absent si tout est nul ; nom `<b>x</b>` affiché en texte dans le sélecteur.
- [x] **Step 2 :** `pnpm --filter @app/web exec vitest run test/dashboard.test.tsx` → FAIL.
- [x] **Step 3 :** implémenter d'après la maquette `dashboard.html` (barre du haut, pleine largeur).
- [x] **Step 4 :** `pnpm --filter @app/web exec vitest run` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the dashboard page with account and period selection"`

### Tâche 26.3 : Bilan MSU par jour et résultats d'expédition

**Files :** Create `apps/web/src/dashboard/daily-chart.tsx`, `apps/web/src/dashboard/outcomes.tsx` ; Modify `apps/web/src/pages/dashboard.tsx` ; Test `apps/web/test/dashboard-charts.test.tsx`.

**Interfaces :**
- `DailyChart({ days, selected, onSelectDay })` : `BarChart` Recharts, une barre par entrée de `days`, couleur `gain` si ≥ 0, `danger` sinon ; barres hors période sélectionnée atténuées ; clic → `onSelectDay(day)` (la page passe en période Jour sur ce jour) ; infobulle date courte + MSU compact ; `aria-label` « Bilan MSU par jour, <mois> : total <x> MSU, <n> jours actifs ».
- `Outcomes({ outcomes })` : liste HTML (pas Recharts) comme la maquette, triée par nombre décroissant, pastille de couleur, barre neutre, nombre et pourcentage fr (« 43,4 % »), total en tête ; résultats à 0 masqués.

- [x] **Step 1 : tests** : `days` avec un jour à −2 M → une barre `danger` ; clic sur le 5 → URL `period=day&day=…-05` ; `aria-label` contient le total ; outcomes `{ resources: 412, nothing: 208, … }` → première ligne « Ressources », « 43,4 % » ; outcomes tous à 0 → « Aucune donnée sur cette période ».
- [x] **Step 2 :** `pnpm --filter @app/web exec vitest run test/dashboard-charts.test.tsx` → FAIL.
- [x] **Step 3 :** implémenter ; disposition 2/3 – 1/3, une colonne sous 640 px.
- [x] **Step 4 :** même commande → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the daily balance chart and expedition outcomes"`

### Tâche 26.4 : Gains et pertes par catégorie, vaisseaux

**Files :** Create `apps/web/src/dashboard/balance-chart.tsx`, `apps/web/src/dashboard/ships-chart.tsx` ; Modify `apps/web/src/pages/dashboard.tsx` ; Test `apps/web/test/dashboard-charts.test.tsx`.

**Interfaces :**
- `BalanceChart({ summary, settings })` : `BarChart` horizontal, une ligne par catégorie de `summary.balance` dont gain ou perte est non nul, plus « Échanges » si `settings.includeTradesInBalance` (reçus en gain, livrés en perte) ; gain `toMsu(gains, settings.msuRatio)` à droite en `gain`, perte en négatif à gauche en `danger` ; infobulle : métal, cristal, deutérium bruts.
- `ShipsChart({ ships })` : `BarChart` horizontal, une ligne par type de vaisseau trouvé ou perdu, deux barres (trouvés `gain`, perdus `danger`), en nombre de vaisseaux ; noms des vaisseaux du catalogue.

- [x] **Step 1 : tests** : balance avec expéditions et combats seulement → deux lignes ; `includeTradesInBalance` vrai avec des échanges → ligne « Échanges » ; faux → pas de ligne ; ships `{ found: { '202': 5 }, lost: { '204': 2 } }` → lignes « Petit transporteur » et « Chasseur léger » ; tout vide → « Aucune donnée sur cette période » dans chaque carte.
- [x] **Step 2 :** même commande que 26.3 → FAIL.
- [x] **Step 3 :** implémenter ; disposition 2/3 – 1/3.
- [x] **Step 4 :** suite web, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS.
- [x] **Step 5 : commit.** `git commit -m "Add the balance by category and ships charts"`

### Tâche 26.5 : Vérification

- [x] Captures bureau (1280 px) et téléphone (390 px) avec l'API simulée (Playwright isolé), comparées à `docs/web-design/screenshots/dashboard*.png` ; pas de défilement horizontal.
- [ ] Conteneur local reconstruit : mêmes chiffres que la fenêtre détail du userscript pour le même compte et la même période (utilisateur).

## Scope 27 — En-têtes de sécurité

Branche : `feature/security-headers`. Spec dashboard, « Sécurité », dernier point.

### Tâche 27.1 : En-têtes sur toutes les réponses

**Files :** Modify `apps/server/src/app.ts` ; Test `apps/server/test/web-static.test.ts`.

**Interfaces :** un hook `onSend` global pose, sans dépendance :
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` (`'unsafe-inline'` pour les attributs `style` de Recharts) ;
- `X-Content-Type-Options: nosniff` ; `Referrer-Policy: same-origin`.

- [x] **Step 1 : tests** : `index.html`, un asset, `/healthz` et `/api/site/session` portent les trois en-têtes ; la CSP contient `frame-ancestors 'none'`.
- [x] **Step 2 :** `pnpm --filter @app/server exec vitest run test/web-static.test.ts` → FAIL.
- [x] **Step 3 :** implémenter.
- [x] **Step 4 :** même commande → PASS ; conteneur local reconstruit : aucune erreur CSP dans la console sur Connexion, Compte, Réglages, Administration et Dashboard.
- [x] **Step 5 : commit.** `git commit -m "Send security headers on every response"`

## Scope 28 — Icônes du jeu dans le dashboard

Branche : `feature/dashboard-game-icons`. Spec : `docs/superpowers/specs/2026-11-17-dashboard-game-icons-design.md`.

### Tâche 28.1 : Adresses partagées et icônes du site

**Files :** Create `packages/shared/src/game-icons.ts`, `apps/web/src/ui/game-icon.tsx` ; Modify `packages/shared/src/index.ts`, `apps/userscript/src/ui/icons.ts` (importe les adresses), `apps/web/src/dashboard/key-figures.tsx`, `apps/web/src/dashboard/ships-chart.tsx`, `apps/server/src/app.ts` (CSP) ; Test `apps/web/test/dashboard-charts.test.tsx`, `apps/web/test/dashboard.test.tsx`, `apps/server/test/web-static.test.ts`, tests existants du userscript.

**Interfaces :**
- `game-icons.ts` : `RESOURCE_SPRITE`, `RESOURCE_SPRITE_INDEX: Record<'metal' | 'crystal' | 'deuterium' | 'darkMatter', number>`, `ARTEFACTS_IMAGE`, `LITHIUM_IMAGE`, `SHIP_IMAGES: Record<string, string>` (valeurs reprises telles quelles de `apps/userscript/src/ui/icons.ts`).
- `ResourceIcon({ kind })` et `ShipIcon({ id })` : `span` décoratif (`aria-hidden`) en image de fond ; vaisseau inconnu → rien.
- Graphique des vaisseaux : étiquette d'axe personnalisée, vignette SVG `image` puis nom.
- CSP : `img-src 'self' data: https://gf1.geo.gfsrv.net https://gf2.geo.gfsrv.net https://gf3.geo.gfsrv.net`.

- [ ] **Step 1 : tests** : la carte « Métal » contient une icône dont le fond pointe vers `RESOURCE_SPRITE` ; « Artefacts » vers `ARTEFACTS_IMAGE` ; le graphique des vaisseaux contient une `image` dont `href` vaut `SHIP_IMAGES['202']` ; la CSP contient `img-src 'self' data: https://gf1.geo.gfsrv.net` et pas `*`.
- [ ] **Step 2 :** `pnpm --filter @app/web exec vitest run` et `pnpm --filter @app/server exec vitest run test/web-static.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter ; commentaire de conformité AGENTS.md §4 (images statiques, aucune requête de jeu).
- [ ] **Step 4 :** suites web, serveur et userscript, `rtk proxy pnpm lint`, `pnpm typecheck`, `pnpm build` → PASS ; captures bureau et téléphone sans erreur de console.
- [ ] **Step 5 : commit.** `git commit -m "Show the game icons on the dashboard"`
