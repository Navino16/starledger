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

### Scope 5 — API (en cours)

| Sujet | Décision | Coût si faux |
|---|---|---|
| Ordre des contrôles | Clé d'abord, puis version du client. | Aucun. |
| Limite de débit | 120/min par utilisateur, par IP si la clé est invalide ; jamais la clé brute. | Aucun. |
| Version du client | Semver strict, pré-versions refusées : le userscript ne doit pas publier de tag `-beta`. | Version de test refusée. |
| Validation des lots | Enveloppe invalide → 400 ; observation invalide → `rejected` individuellement. | Aucun. |
| Doublons | Comparaison sur l'événement interprété (un rapport FR/EN est un doublon) ; deux non-reconnus identiques = doublon. | Quelques relectures marquées en conflit. |

## Écart noté

Le design §6.4 prévoit la lecture et l'écriture des réglages par l'API ; le plan ne prévoit que la lecture (dans la réponse de stats). Aucune écriture par l'API dans le MVP.

## En attente côté utilisateur

- Réponses ToolDev sur le fil forum (masquage d'OGLight, données d'autres joueurs dans les rapports de combat).
- Captures PTS pour les anomalies et les transports (scopes 12 et 13).
- Installer la GitHub App Codecov (facultatif).
- Réactiver CodeQL dans le ruleset après le premier merge `develop` → `main`.
