# Journal des décisions

Décisions prises pendant l'exécution du plan (scopes 1 à 5). Chaque entrée indique sa source, et pour les arbitrages pris sans l'utilisateur, ce qu'ils coûtent s'ils sont faux. À relire : les entrées marquées **À valider**.

## Décisions de l'utilisateur

| Date | Sujet | Décision |
|---|---|---|
| 2026-11-11 | Taille, épuisement, taille des artefacts | L'événement garde la valeur brute du jeu (entier ou chaîne) ; une valeur inconnue est conservée. Les libellés (`EXPEDITION_SIZES`, `ARTIFACT_SIZES`) sont appliqués à l'affichage. |
| 2026-11-11 | Listes absentes d'un combat | `loot`, `debris`, `repairedTechnologies` absents d'un `result` présent valent une liste vide. Un `result` absent reste non reconnu. À confirmer sur le PTS (scope 10). |
| 2026-11-11 | Combats en un round (48) de sondes seules | Les sondes perdues sont déduites, comme pour les combats 25. Design §5.6 corrigé. |
| 2026-11-11 | Toutes les pertes | Toutes les pertes de vaisseaux sont déduites par défaut. `ignoreExpeShipsLoss` reste une option désactivée par défaut. |
| 2026-11-11 | Découvertes de formes de vie | Aucun vaisseau de flotte engagé : pas de `shipsLost` sur les découvertes ; `ship_lost` reste une issue. |
| 2026-11-11 | Réglages de valorisation | Ils ne s'appliquent qu'aux valeurs calculées à la lecture ; les événements stockés ne sont jamais modifiés. Design §5.6 amendé. |
| 2026-11-11 | Couverture | `codecov.yml` : 80 % projet (tolérance 1 point) et 80 % patch, dossiers `test/` exclus. |
| 2026-11-11 | Garde-fou PTS | Userscript limité au PTS (`@match` s808-en + vérification de la meta `ogame-universe`), prévu tâche 7.1, retiré tâche 14.1 étape 0. |
| 2026-11-11 | CLI admin | Tester la saisie masquée du mot de passe (fait, faux terminal dans les tests). |
| 2026-11-11 | Merge autonome | Merger soi-même les PR quand la CI et Codecov sont OK ; ne s'arrêter que pour une décision. |

## Arbitrages pris sans l'utilisateur

### Scope 1 — Parseurs

| Sujet | Décision | Coût si faux |
|---|---|---|
| Fixtures avant parseurs | Les valeurs attendues suivent les règles des tâches 1.3 à 1.5. | Quelques valeurs à réécrire. |
| Ressource absente | Clé absente d'un `resourcesgained` présent = 0 connu ; attribut absent = `null`. | Quelques totaux à 0 au lieu de « ? ». |
| Retard d'expédition | Règle OGLight de la doc §3.1 : `returnTimeAbsoluteIncreaseHours >= 0` → retard (le plan disait `> 0`). **À valider** au scope 10. | Un rapport (1, 0) compté en retard. |
| `[]` pour un objet vide, format des clés brutes | Reportés aux captures du scope 10. | Rapports non reconnus jusqu'à la relecture. |

### Scope 2 — Stats

| Sujet | Décision | Coût si faux |
|---|---|---|
| Pirates et aliens | Pertes du message d'expédition (41) et du combat en position 16 (25) toutes deux déduites, comme le plan. **À valider** : capture dédiée au scope 10. | Pertes de combat d'expédition comptées deux fois. |
| Arrondis | Tuiles non arrondies, seul le MSU est arrondi à l'entier supérieur. | Cosmétique. |
| Combats en un round | Comptés dans le nombre, les sondes et les pertes ; victoires, défaites, butin et débris viennent des 25 seulement. | Sens des compteurs du détail. |
| Vaisseau inconnu | Compté en nombre, valorisé à 0. | Futurs vaisseaux sous-valorisés. |
| XP des formes de vie | Seule l'XP des découvertes est agrégée. | XP d'expédition absente du détail. |
| Bilan par catégorie | `balance` (gains et pertes valorisés) par catégorie ; tuiles = somme des bilans. | Quelques champs en plus. |
| Codecov « OK » | Tous les tests passent, projet ≥ 80 %, patch ≥ 80 %. | PR mergée avec une couverture de patch faible. |

### Scope 3 — Socle serveur

| Sujet | Décision | Coût si faux |
|---|---|---|
| Migrations | Fournisseur de migrations dans le code (serveur empaqueté par tsdown). | Aucun. |
| Vues | Fichiers `.eta` copiés à côté du bundle, vérifiés par la CI. | Vues manquantes, détectées par la CI. |
| `TRUST_PROXY` | Par défaut `loopback,linklocal,uniquelocal` (le plan disait `true`, qui laissait contourner la limite de connexion). Formes acceptées : `true`, `false`, nombre de sauts, liste d'IP/CIDR. **À valider** selon ton reverse proxy. | Un proxy à IP publique doit être configuré explicitement. |
| Scripts de build | Scripts de `cpu-features`, `protobufjs`, `ssh2` (testcontainers) refusés via `allowBuilds`. | testcontainers via SSH indisponible. |
| Dates Postgres | Gardées en chaînes `YYYY-MM-DD`. | Aucun. |

### Scope 4 — Comptes

| Sujet | Décision | Coût si faux |
|---|---|---|
| Préfixe des clés API | `slk_` au lieu de `ogd_` (ancien nom du projet). | Cosmétique. |
| Invitations | `createInvitation` prend `publicUrl` ; un seul message 410 ; connexion puis `/account` après inscription. | Aucun. |
| Ratio MSU | Entre 0,01 et 100. | Ratio exotique refusé. |
| Langue et serveur | `lang` = `[a-z]{2,3}`, `serverId` ≤ 2 147 483 647 (shared et route). | Code de langue exotique refusé à l'ingestion. |
| Routes web | Regroupées dans un plugin qui charge la session ; `/healthz` et l'API en dehors. | Aucun. |

### Scope 5 — API

| Sujet | Décision | Coût si faux |
|---|---|---|
| Ordre des contrôles | Identification, limite de débit, puis rejet (401, version) dans `onRequest` : un appelant non authentifié n'oblige pas le serveur à lire un corps de 2 Mo. Le 413 vient donc après l'authentification. | Aucun. |
| Limite de débit | 120/min par utilisateur, par IP si la clé est invalide ; jamais la clé brute. | Aucun. |
| Version du client | Semver strict, pré-versions refusées : le userscript ne doit pas publier de tag `-beta`. Même règle pour `clientVersion` du corps. | Version de test refusée. |
| Validation des lots | Enveloppe invalide → 400 ; observation invalide → `rejected` individuellement. | Aucun. |
| Doublons | Comparaison sur l'événement interprété (un rapport FR/EN est un doublon) ; deux non-reconnus identiques = doublon ; un conflit relu à l'identique du stocké = doublon. | Quelques relectures marquées en conflit. |
| Nom du joueur | Mis à jour seulement si le nom reçu est non nul (COALESCE) : inconnu ≠ vide. | Un nom renommé puis inconnu reste périmé. |
| Non reconnu | Une nouvelle lecture non reconnue ne dégrade ni ne marque en conflit un événement ok ou conflit (ack `duplicate`). | Une régression de parseur passe inaperçue dans les acks. |
| Remplacement par un parseur amélioré | Non reconnu existant → nouvel ok : met aussi à jour `occurred_at`, `day`, `parser_version`. | Aucun. |
| `devices.client_version` | Vient du `clientVersion` validé du corps. | Cosmétique. |
| 413 | Renvoyé en JSON (`payload_too_large`) : l'API ne renvoie jamais de HTML. | Aucun. |
| Erreurs en base | Un savepoint par observation ; seules les erreurs de données (SQLSTATE 22 et 23) donnent `rejected` + log ; toute autre erreur annule le lot, 500, le client réessaie. | Une erreur transitoire classée 22/23 perd une observation. |
| Parseur qui lève | Traité comme non reconnu (journalisé), le brut est conservé pour reparse. | Un parseur cassé se cache dans les non-reconnus. |
| `deviceId` | `z.uuid()` (colonne `uuid`) : le userscript génère un UUID (`crypto.randomUUID()`). | Le userscript doit s'y conformer. |
| Événements non reconnus | `data = null` ; la raison se recalcule depuis `observations.payload`. | Aucun. |
| `ApiError` | Tous les codes émis par le serveur plus ceux du client (`not_configured`, `unreachable`) ; `sendError` typé partout. | Aucun. |
| Compte inconnu ou d'un autre utilisateur | Stats : 200 avec un résumé vide et `counts.unrecognized` à 0, jamais 404 (pas d'oracle d'existence entre utilisateurs). | Aucun. |
| `today` | Requis pour toutes les périodes, y compris `all`. | Le client doit l'envoyer même pour `all`. |
| `counts.unrecognized` | Tous les non-reconnus du compte, quelle que soit la période (leur jour peut être inconnu). | Le compteur ne suit pas la période choisie. |
| Réglages dans les stats | `getValuationSettings` de l'appelant pour (serveur, langue), défauts si aucun. | Aucun. |
| Bornes de saisie | `observedAt` et `sentAt` ≤ 8,64e15 (Date valide) ; `playerId` ≥ 0, comme la route de stats. | Aucun. |
| Verrou de compte | Le `ON CONFLICT DO UPDATE` du compte sérialise les lots concurrents d'un même compte, ce qui rend la détection de doublons sans course. | Passer à DO NOTHING + SELECT rouvrirait la course. |

**Notes pour le scope 7 (userscript)**

- M4 : `MAX_BATCH` 200 × jusqu'à 64 Ko de `raw` peut dépasser la limite de corps de 2 Mo. Le userscript doit plafonner les lots par taille sérialisée et gérer un 413 sur un lot d'une seule observation, sinon la file reste bloquée.
- `deviceId` doit être un UUID (`crypto.randomUUID()`) ; aucun tag de version pré-release.
- M5 : deux lots concurrents touchant deux comptes dans l'ordre inverse peuvent s'interbloquer (40P01), donc 500 ; le client réessaie (accepté).

### Scope 6 — Docker

| Sujet | Décision | Coût si faux |
|---|---|---|
| Port publié | `compose.yaml` publie l'app sur `127.0.0.1:3000` seulement ; un proxy sur le LAN demande une modification d'une ligne, documentée. | Une ligne à éditer. |
| CI Docker | Aucun job de build Docker dans ce scope (la publication relève du scope 14). | Le Dockerfile peut se dégrader sans alerte jusqu'au prochain build manuel. |
| Version de PostgreSQL | `postgres:17-alpine`, comme le plan. | Version majeure plus ancienne ; une montée de version demande un dump/restore. |
| `pnpm deploy` | `pnpm deploy --prod --legacy` (requis par pnpm 12) ; les 97 paquets de production correspondent au lockfile. | Aucun. |
| `@app/shared` | Déplacé en `devDependencies` du serveur : il est bundlé par tsdown, donc absent de l'image. | Aucun. |
| Revue et correctifs | Une seule revue pour la tâche et le scope ; une vague de correctifs (restauration, notes de déploiement, cache de couches, `.dockerignore`). | Aucun. |

## Écart noté

Le design §6.4 prévoit la lecture et l'écriture des réglages par l'API ; le plan ne prévoit que la lecture (dans la réponse de stats). Aucune écriture par l'API dans le MVP.

## En attente côté utilisateur

- Réponses ToolDev sur le fil forum (masquage d'OGLight, données d'autres joueurs dans les rapports de combat).
- Captures PTS pour les anomalies et les transports (scopes 12 et 13).
- Installer la GitHub App Codecov (facultatif).
- Réactiver CodeQL dans le ruleset après le premier merge `develop` → `main`.
