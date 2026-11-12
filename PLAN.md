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
| 11 | Carburant | ☐ (code fait, vérification PTS 11.2 step 5) |
| 12 | Transports entre joueurs | ✅ |
| 13 | Anomalies | ☐ (captures reçues, à détailler) |
| 14 | Dossier de tolérance et publication | ☐ |
| 15 | Renovate | ✅ (config ; installer l’app Renovate) |

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
  - les rapports affichés : expéditions, combats (y compris noms et coordonnées des autres joueurs), recyclages, champs d'épaves, découvertes, transports ;
  - les départs de flotte et leur carburant ;
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

- [ ] **Step 1 :** l'utilisateur affiche sur le PTS chaque type de message listé au design §9.2 et exporte la file. Captures à inclure en plus :
  - une expédition `combatPirates` ou `combatAliens` (41) **et** son rapport de combat en position 16 (25) : les pertes de vaisseaux ne doivent être déduites qu'une fois dans `computeStats` (aujourd'hui, les deux sources sont déduites) ;
  - un combat de défense sans réparation, un combat sans butin : confirmer que le jeu omet les listes vides ou écrit `[]`.
- [ ] **Step 2 : écrire les tests** à partir des captures, avec les résultats attendus vérifiés à la main contre le message affiché. Lancer : les écarts apparaissent en FAIL.
- [ ] **Step 3 : corriger** les parseurs et incrémenter `PARSER_VERSION`.
- [ ] **Step 4 : lancer** `pnpm test`. Attendu : PASS.
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
- [ ] **Step 5 : vérifier sur le PTS.** Une expédition envoyée augmente le carburant de l'encart de la valeur affichée par le jeu. Un envoi refusé ne change rien.
- [x] **Step 6 : auto-audit** (`AGENTS.md` §7), noté pour la PR.
- [x] **Step 7 : commit.** `git commit -m "Track fuel of confirmed fleet dispatches passively"`

---

## Scope 12 — Transports entre joueurs

Captures reçues le 2026-11-12 : les trois cas sont du type 33 (`docs/ogame-data-formats.md` §3.7).

- [x] 12.1 parseur et stats
- [x] 12.2 affichage dans le détail

Travail prévu :
- un parseur `TransportEvent` `{kind:'transport', direction:'received'|'delivered'|'internal', resources}`, sans identité ni coordonnées du partenaire (`docs/decisions.md`, scope 12) ; les transports internes ne sont comptés nulle part ;
- l'ajout de la catégorie « Échanges » à `StatsSummary` (reçu, envoyé, net), qui n'entre dans les tuiles que si `includeTradesInBalance` est vrai ;
- le type 34 n'est plus collecté ; les événements de type 33 déjà stockés sont réinterprétés par le `reparse` existant (les événements non reconnus sont toujours reparsés) ;
- l'affichage dans le détail.

## Scope 13 — Anomalies

Captures reçues le 2026-11-12 (formats dans `docs/ogame-data-formats.md` §3.9 et §9, règles dans `docs/decisions.md`). Quatre tâches : 13.1 combats d'anomalie (cette tâche), 13.2 récompenses du message 76, 13.3 lithium de la page des anomalies, 13.4 affichage. Les captures encore manquantes sont listées dans `docs/pts-captures.md` et ne le bloquent pas.

Travail prévu :
- l'observation des actions sur la page dédiée (scan, choix, récupération, remboursement), en lecture seule ;
- un événement par étape ;
- les chiffres « lithium dépensé », « lithium remboursé » et « net » ;
- les récompenses dans une catégorie « anomalies » ;
- une règle d'exclusion ou de rattachement si les missions d'anomalie produisent aussi des rapports de combat ou de transport classiques.

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
