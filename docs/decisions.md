# Journal des décisions

Décisions prises pendant l'exécution du plan (scopes 1 à 7). Chaque entrée indique sa source, et pour les arbitrages pris sans l'utilisateur, ce qu'ils coûtent s'ils sont faux. À relire : les entrées marquées **À valider**.

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
| 2026-11-12 | Fenêtres réglages et détail (remplace la Ruling M2) | Les réglages (consentement compris) et le détail des stats s'ouvrent dans une fenêtre centrée avec un fond sombre plein écran, comme les fenêtres d'OGLight. Elle n'est ouverte que par un clic du joueur ; elle se ferme par son bouton, Échap ou, pour le détail seulement, un clic sur le fond ; elle est entièrement retirée à la fermeture. Le fond recouvre la pub, la Boutique, le Marchand et le footer tant qu'elle est ouverte : GRAY AREA (AGENTS.md §1.7, §3), question posée sur le fil du forum le 2026-11-12, publication bloquée jusqu'à l'accord écrit d'un ToolDev. Si la réponse est non : fenêtre sans fond limitée à la zone de contenu, ou retour à M2. |
| 2026-11-12 | Partenaire des transports (remplace la Ruling du scope 12) | L'événement `transport` porte l'identité (id, nom) et les coordonnées du partenaire dès maintenant, l'outil n'étant pas publié. À revoir avant la publication (scope 14) selon la réponse des ToolDevs sur les données d'autres joueurs. Tâche 12.3. |
| 2026-11-12 | Antimatière des récupérations d'anomalie | Confirme la Ruling : l'antimatière payée pour une récupération n'est pas déduite de la tuile AM (tuile = AM trouvée) ; elle est affichée à part dans le détail des anomalies. À revoir à l'usage. |
| 2026-11-12 | Vaisseaux des récompenses d'anomalie (remplace l'arbitrage initial à 100 %) | Valorisés selon un réglage serveur `anomalyShipRatio` par univers, comme `expeditionShipRatio` (défaut 100 %). Tâche 13.5. |
| 2026-11-12 | Arrivées de flotte (34) déjà stockées | Rien à faire tant qu'aucun serveur n'est configuré, mais le nettoyage est à prévoir : ignorer à l'ingestion et au `reparse` les types de message non suivis. Tâche 10.3. |
| 2026-11-12 | Tuiles de l'encart | Pas de tuile carburant : il est déjà déduit de la tuile deut (sauf `ignoreConsumption`) et reste visible dans le détail. Ordre : métal, cristal, deut / AM, artefacts, lithium / MSU sur toute la largeur. Quand l'encart est à jour, l'en-tête n'affiche que l'heure (libellé complet au survol). Design §5.6 amendé. |

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

### Scope 7 — Userscript : socle

| Sujet | Décision | Coût si faux |
|---|---|---|
| Scope 7: Ruling A | Le type d'erreur d'`ApiResult` est l'`ApiError` partagé : 401 `invalid_key`, 426 `client_outdated`, 429 `rate_limited`, 413 `payload_too_large`, 400 `invalid_payload`, 404 `not_found`, autre non-2xx `server_error`, réseau ou délai `unreachable`, JSON invalide sur un 2xx `server_error`. | L'interface doit traduire 9 codes au lieu de 5. |
| Scope 7: Ruling B | `SyncState` gagne `rejected: number` (cumulatif, persisté avec la file). | Aucun. |
| Scope 7: Ruling C | Un lot fait au plus 100 éléments et 1,5 Mo sérialisés ; un 413 sur un lot de plusieurs éléments le divise par deux et réessaie dans le même vidage (sans minuterie) ; un 413 sur un élément seul le retire et l'ajoute à `rejected`, sinon la file reste bloquée (note M4 du scope 5). | Une observation trop grosse est abandonnée. |
| Scope 7: Ruling D | `build.test` lance le build Vite par programme dans un dossier temporaire (autonome, sans dépendre de l'ordre de la CI). | Test plus lent. |
| Scope 7: Ruling E | `clientVersion` = version du `package.json` du userscript, injectée au build, testée contre `parseSemver` et `MIN_CLIENT_VERSION` ; `deviceId` = `crypto.randomUUID()`. | Aucun. |
| Scope 7: Ruling F | L'option `timeout` de `GM_xmlhttpRequest` est permise : le délai est géré par le moteur GM, ce n'est ni une minuterie de notre code ni une action différée (AGENTS.md §1.2/§1.3). | Retirer l'option ; une requête bloquée garde le verrou du vidage jusqu'au déchargement de la page. |
| Scope 7: Ruling G | Le masquage de l'encart OGLight est construit comme prévu, marqué GRAY AREA ; la publication reste bloquée tant que le ToolDev n'a pas répondu (AGENTS.md §3 permet le prototype). | Le masquage est retiré avant le scope 14. |
| Task 7.1: Ruling | `vite ^8.3.7` (la 8.3.8 avait moins de 24 h, `minimumReleaseAge`) ; l'entrée `minimumReleaseAgeExclude` ajoutée par `pnpm add` est annulée. | Aucun : le caret prendra la 8.3.8 plus tard. |
| Task 7.3: Ruling (retrait par id) | Les éléments sont retirés par `clientObservationId` depuis une lecture fraîche du stockage GM, jamais en réécrivant un instantané périmé (le stockage est partagé entre onglets). | Aucun. |
| Task 7.3: Ruling (ack ambigu) | Un ack qui omet l'id d'un élément, ou un ack mal formé (`results` n'est pas un tableau), laisse l'élément en file (ack mal formé : état `server_error`) ; aucune donnée n'est perdue sur une réponse ambiguë. | Un élément déjà stocké par le serveur est renvoyé une fois (doublon). |
| Task 7.3: Ruling (vidage complet) | Un appel à `flush()` vide tous les lots jusqu'à file vide ou erreur, sans minuterie. | Un long vidage sur un gros arriéré. |
| Task 7.3: Ruling (file pleine) | « File pleine » est déduit de la taille stockée (≥ 5000) dans `state()`, pas d'un drapeau par onglet ; l'état vaut `error` avec `error` nul tant qu'elle est pleine, et l'interface le distingue par `pending` ≥ capacité. | L'interface demande un test de plus. |
| Task 7.4: Ruling (encart) | Le petit encart « Configurer » est inséré sous `#links` (emplacement du futur encart de stats, design §4), en flux normal, jamais en `fixed`/`absolute`, jamais sur Marchand, Officiers, Boutique, la barre de pub ou le pied de page (AGENTS.md §1.7). | Déplacé au scope 9. |
| Task 7.4: Ruling (démarrage) | Avec consentement, `main()` fait : garde PTS, réglages, commande de menu, état du masquage OGLight, un vidage de la file au chargement si URL et clé sont définies (design §5.5) ; les écouteurs de collecte relèvent du scope 8. | Aucun. |
| Task 7.4: Ruling (retrait) | Retirer le consentement vide aussi la file locale et arrête tout envoi dans la page (AGENTS.md §1.9). | Des observations non envoyées sont perdues au retrait (choix de l'utilisateur). |
| Task 7.4: Ruling (panneau) | Le panneau d'options est en ligne, sans cadre modal, en DOM pur, toutes les chaînes via i18n (fr/en, en par défaut selon la meta `ogame-language`). | Remis en forme au scope 9. |
| Task 7.4: Ruling (clé) | Le champ de clé est `type=password` et la clé n'est jamais réaffichée (le placeholder indique « enregistrée »). | Aucun. |
| Scope 7: Ruling (commentaires) | Les commentaires de conformité du userscript commencent par `//!` (texte identique) et le build garde les commentaires « legal » (`rolldownOptions.output.comments.legal`) ; `build.test` vérifie que les marqueurs survivent. Le défaut de vite-plugin-monkey les supprimait. | Préfixe cosmétique. |
| Scope 7: Ruling (version de consentement) | Le consentement stocke `CONSENT_VERSION` (1) ; un consentement sans version ou plus ancien vaut absence de consentement, donc un changement de texte force un nouveau consentement. | Un clic de consentement en plus. |
| Scope 7: Ruling (changement de serveur) | Changer l'URL exige une clé saisie (jamais la clé stockée, y compris pour « Tester ») et remet le consentement à zéro avec l'écran de consentement sur la nouvelle destination ; la file locale est aussi vidée (hors spec : sinon des données collectées pour le serveur A partiraient vers B). | Une étape de plus pour changer de serveur ; observations en attente perdues. |
| Scope 7: Ruling (hôtes du jeu) | L'URL du serveur ne peut pas être un hôte OGame/Gameforge (`*.gameforge.com`), ce qui rend « aucune requête vers le jeu » démontrable par le code (AGENTS.md §4). | Aucun. |
| Scope 7: Ruling (http) | `http://` est accepté avec un avertissement visible (homelab en LAN/localhost) plutôt que refusé. | Une clé en clair sur un réseau hostile malgré l'avertissement. |
| Scope 7: Ruling (course inter-onglets) | La course d'enfilage entre onglets (cache de valeurs par onglet de Tampermonkey) est réglée au pré-vol du scope 8, là où l'enfilage commence ; rien n'enfile au scope 7. Chaque collecteur revérifie le consentement avant chaque enfilage. | Aucun maintenant ; au scope 8, une observation peut être perdue ou dupliquée. |
| Scope 7: Ruling (clé retirée, ping) | Un bouton « Supprimer la clé » (design §5.7) ; un corps 2xx de ping sans `username` texte vaut `server_error` ; `@noframes` ajouté ; `GM_deleteValue` retiré des droits ; `@connect *` commenté (serveur choisi par l'utilisateur, après consentement, AGENTS.md §1.9). | Aucun. |

### Scope 8 — Userscript : collecte

| Sujet | Décision | Coût si faux |
|---|---|---|
| Scope 8: Ruling H | `@grant unsafeWindow` ajouté, utilisé UNIQUEMENT pour lire les globales de la page (`serverTime`, `ogame.messages.content`) et attacher un écouteur jQuery `ajaxSuccess` ; jamais pour appeler une fonction du jeu ni envoyer une requête. `build.test` vérifie la nouvelle liste exacte et le commentaire `//! AGENTS.md §4: passive read of page globals, no game function called`. | Un relecteur questionne `unsafeWindow` ; l'alternative (script injecté dans la page) est pire. |
| Scope 8: Ruling I | Course d'enfilage entre onglets acceptée comme limite documentée : un message perdu dans la fenêtre de quelques ms est recollecté à la prochaine consultation de la page, le serveur dédoublonne. | Observation manquante rare jusqu'à la relecture de la page. |
| Scope 8: Ruling J | Le collecteur relit le consentement (réglages frais) avant chaque enfilage et ne fait rien sans lui ; il n'est installé que si le consentement est vrai (AGENTS.md §1.9). | Aucun. |
| Task 8.2: Ruling (décalage) | Le décalage UTC du serveur est calculé UNE fois au démarrage (page fraîche) et passé au contexte du collecteur ; `serverTime` peut être figé au chargement et dériver face à `Date.now()`. | Aucun (le scope 10 vérifie `serverTime` sur le PTS). |
| Task 8.2: Ruling (installation) | Le collecteur n'est installé qu'au démarrage avec consentement ; un consentement donné en cours de page démarre la collecte au chargement suivant. Compte ou décalage illisible : rien n'est installé (inconnu ≠ 0). | Les messages lus sur la page de consentement ne sont collectés qu'à la consultation suivante. |
| Task 8.2: Ruling (ids vus) | Les `msgId` sont marqués vus avant l'enfilage ; ceux refusés par une file pleine sont retentés au chargement suivant. | Aucun (l'état « file pleine » est affiché). |
| Scope 8: Ruling (revue) | La revue de 8.2 vaut revue de tâche ET revue finale de branche (8.1 déjà revue). | Aucun. |
| Scope 8: Ruling (garde) | Chaque point d'entrée de notre code dans la pile d'appels du jeu (écouteur `ajaxSuccess`, `deliver` au démarrage, `main`) est dans un try/catch qui avale et ne relance jamais : AGENTS.md §4/§1.5, ne jamais altérer une requête du jeu. | Nos erreurs sont silencieuses (pas de bruit console dans la page du jeu). |
| Scope 8: Ruling (todayKey) | `todayKey(offsetMinutes)` prend le décalage calculé une fois au démarrage. | Aucun. |

À vérifier sur le PTS au scope 10 (Chrome et Firefox avec Tampermonkey) : `ogame.messages.content` est rempli avant l'`ajaxSuccess` global ; `getMessagesList` déclenche bien des événements globaux ; le jQuery de la page peut appeler notre fonction du bac à sable (Firefox peut exiger `exportFunction`) ; les vrais `data-raw-*` restent dans les limites du schéma.

### Scope 9 — Userscript : encart et détail

| Sujet | Décision | Coût si faux |
|---|---|---|
| Scope 9: Ruling K | Un seul encart sous `#links` dont le contenu dépend de l'état : sans consentement, le bouton « Configurer » (comportement du scope 7) ; consentement sans serveur, « Configurer le serveur et la clé » ; sinon les tuiles de stats. Il remplace l'encart de configuration du scope 7, sans seconde insertion. | Aucun. |
| Scope 9: Ruling L | Stats de l'encart demandées à NOTRE serveur (`getStats`, `period=day`, `today=todayKey(décalage du démarrage)`) une fois au chargement après le vidage de la file, puis après chaque vidage consécutif à une collecte ; jamais sur minuteur. En cas d'erreur, les stats en cache du compte sont affichées marquées « ancien » avec leur heure (design §5.5/§5.6, AGENTS.md §1.3/§4). | Aucun. |
| Scope 9: Ruling M (remplacée par M2) | Le détail était une fenêtre modale ouverte par l'utilisateur (Échap, clic sur le fond, bouton), avec un fond plein écran. | Remplacée : le fond assombrissait la barre de pub, la Boutique, le Marchand et le footer, ce que AGENTS.md §1.7 interdit à la lettre. |
| Scope 9: Ruling M2 (remplace M, remplacée le 2026-11-12 par une décision utilisateur) | Aucun calque ni fond plein écran : le détail est un panneau dans le flux, inséré en tête de la zone de contenu du jeu (`#contentWrapper`, ou `#middle`, ou à défaut juste après l'encart), jamais au-dessus de la barre du haut, du menu de gauche, des bannières ni du footer, sans changement d'opacité. Il se ferme par son bouton, Échap ou un clic à l'extérieur, et est entièrement retiré (nœud et écouteurs). AGENTS.md §0 « dans le doute, interdit » et §1.7 lu à la lettre ; évite une décision d'un ToolDev. | Moins l'effet « fenêtre » ; le contenu du jeu descend tant que le panneau est ouvert. Les identifiants `#contentWrapper` et `#middle` ne sont pas documentés dans `docs/ogame-data-formats.md` : à vérifier sur le PTS au scope 10. |
| Scope 9: Ruling N | Cache des stats par compte (`serverId-lang-playerId`) dans le stockage `GM_*`, dernière réponse et heure seulement. | Aucun. |
| Task 9.1: Ruling (réglages) | Les stats ne sont pas redemandées après l'enregistrement des réglages avant le prochain chargement de page ; un panneau d'options ou de consentement ouvert n'est jamais remplacé par un rendu de stats (affiché à la fermeture). | Une page à recharger avant les premières stats. |
| Task 9.1: Ruling (vidages concurrents, mobile) | Les vidages concurrents partagent une seule promesse en cours (`inFlight`, tâche 7.3) ; sur mobile, 6 tuiles en grille 3 × 2 et le carburant sur sa propre ligne, accepté (vérification visuelle au scope 10). | Aucun. |
| Scope 9: Ruling (revue) | La revue de 9.2 vaut revue de tâche ET revue finale de branche (9.1 déjà revue). | Aucun. |
| Task 9.2: Ruling (revue, corrections) | Ouverture du détail : la file est vidée avant la première requête de stats (design §4.1) ; ligne FdV et ligne Net ajoutées, phrase de périmètre corrigée ; un seul détail ouvert à la fois, focus géré ; consentement revérifié après chaque réponse avant tout cache ou rendu. | Aucun. |

### Scope 10 — Préparation de la validation PTS

Le scope reste ouvert (☐) : il dépend des captures PTS de l'utilisateur. Cette branche ne fait que préparer.

| Sujet | Décision | Coût si faux |
|---|---|---|
| Périmètre de la branche | Scope 10 : Ruling : bloqué sur les captures PTS (tâche 10.1 étapes 1 à 6). Seuls sont préparés l'export de debug (10.1a) et la commande `reparse` (10.2), indépendante des captures. | Aucun. |
| Export de debug | Scope 10 : Ruling : disponible uniquement avec consentement, il exporte des données collectées localement sans rien envoyer ; téléchargement d'un `.json` via Blob et `<a download>` (pas de grant `GM_download`) ; le libellé du menu indique « rien n'est envoyé » (AGENTS.md §1.9). | Aucun. |
| Task 10.2 : compteur `skipped` | Task 10.2 : Ruling : compteur `skipped` en plus (événements ignorés sur une erreur de données) ; règles de l'étape 4 extraites dans `ingest/merge.ts` (`mergeReading`), partagées par l'ingestion et `reparse`. | Aucun. |
| Reparse : lecture différente | Scope 10 : Ruling : en reparse seulement, un événement `ok` dont la relecture de son observation source donne une autre lecture `ok` est remplacé (données, kind, date, jour, version), pas mis en conflit : les deux lectures viennent du même brut, donc la différence vient du parseur. Les événements `conflict` sont relus de la même façon. L'ingestion garde les règles du scope 5 (observations différentes). | Un reparse pourrait écraser des données qu'on croyait figées ; aucune n'existe, car elles dérivent toujours du brut. |
| Observation source | Scope 10 : Ruling : quand l'ingestion remplace un événement non reconnu par la lecture `ok` d'une observation ultérieure, `first_observation_id` pointe sur cette observation, pour que `reparse` relise le bon brut. | Nom de colonne un peu trompeur ; pas de migration. |

Notes pour l'utilisateur :

- Pour capturer, donner le consentement avec une URL qui ne mène nulle part (`https://starledger.invalid`) et ne saisir aucune clé API : sans clé, rien n'est envoyé et la file reste disponible pour l'export. L'écran de consentement refuse une URL vide.
- Vérifier que le téléchargement de l'export fonctionne dans Tampermonkey (Chrome, Firefox, mobile) à la première capture.
- Les exports contiennent `playerId` et le nom : les anonymiser avant de les committer comme fixtures (tâche 10.1 étape 1).

### Scope 13 — Anomalies (préparation)

| Sujet | Décision | Coût si faux |
|---|---|---|
| Combats d'anomalie | Scope 13 : Ruling : un combat 25 dont `defenderspaceobject.type` vaut `anomaly` est rattaché à la catégorie « anomalies » (ses pertes y sont déduites), pas aux combats ; critère indépendant de la langue, contrairement au nom du PNJ. | Les pertes changent de catégorie ; un `reparse` suffit à corriger. |
| Récompenses d'anomalie | Scope 13 : Ruling : attributs bruts du message 76 d'abord, s'ils apparaissent (l'absence actuelle est probablement un oubli d'OGame, selon l'utilisateur) ; sinon le HTML (`.loot-item`), en lecture passive du DOM de la page ouverte par le joueur (AGENTS.md §4). Un format HTML inattendu donne « non reconnu », jamais zéro. « Récompense reçue » et « Butin » comptent tous deux comme gains d'anomalie. | Si « Butin » n'est pas un gain d'anomalie, il faudra le reclasser. |
| Dépenses de lithium | Scope 13 : Ruling : observées au `ajaxSend`/`ajaxSuccess` des actions que le joueur déclenche sur la page des anomalies (`performScan`, `collectRewards`), sans jamais appeler `fetchScanCost` ni `fetchCurrentLithium` nous-mêmes (AGENTS.md §4) ; coût du scan lu dans `#scanCostValue`, coût d'une récupération dans `.collectTotalValue` de la fenêtre ouverte au clic sur « Accepter » (et non `.rewardCostsValue`, qui couvre toutes les vagues) ; une récupération directe sans fenêtre a un coût inconnu ; une récupération en antimatière enregistre l'antimatière payée (`data-dark-matter-price`) et, comme lithium dépensé, le solde affiché au clic, puisqu'elle vide tout le lithium possédé (vérifié sur le PTS). Pas de calcul par différence de solde : la production change le solde en continu. | Un coût illisible au moment de la requête devient inconnu ; en antimatière, le lithium dépensé peut s'écarter de quelques secondes de production. |
| Récompenses extraites par le client | Scope 13 : Ruling : le collecteur lit le HTML du message 76 et le range dans `raw` sous les clés `x-loot` et `x-anomalycoords` (préfixe `x-` : valeur lue par le client, pas un `data-raw-*`), pour que le serveur puisse les re-parser comme n'importe quel brut. | Si le HTML du jeu change, les récompenses deviennent non reconnues jusqu'à la mise à jour du collecteur. |
| Lecture qui complète un événement | Scope 18 : Ruling : une nouvelle lecture d'un événement `ok` qui ne fait que renseigner ses valeurs inconnues (`null` ou absentes), toutes les autres égales, le remplace ; une lecture plus pauvre le laisse intact (doublon). Sinon, conflit comme avant (`apps/server/src/ingest/merge.ts`). Motif : un message 76 lu par l'ancien collecteur (sans `x-xp`) puis par le nouveau ne doit pas finir en conflit. | Une lecture fausse qui ne diffère que sur des valeurs inconnues de l'existant est acceptée sans signal. |
| Étapes d'une anomalie | Scope 13 : Ruling : seuls le scan et la récupération (lithium ou antimatière) sont enregistrés ; l'activation d'une mission (`activateMission`) ne l'est pas, elle est gratuite et ne porte aucune quantité (vérifié sur le PTS) ; le remboursement est porté par l'événement de récupération (`lithiumBonus`), aucun montant n'ayant encore été capturé. | Une vue « anomalie scannée mais jamais faite » demandera de collecter `activateMission`. |
| Types 70, 75, 77 | Scope 13 : Ruling : pas d'événement dans le MVP, ils ne portent aucune quantité ; à reconsidérer pour compter les missions faites ou ratées. | Aucun. |
| Bonus de lithium | Scope 13 : Ruling : `lithiumBonus` vaut 0 si la réponse dit `null`, inconnu sinon ; le JSON brut est gardé dans l'observation pour un futur `reparse`. | Un bonus présent reste inconnu (compté dans `refundUnknown`) jusqu'à la capture d'une réponse avec bonus. |
| Lithium net | Scope 13 : Ruling : `net = remboursé − dépensé` (négatif = coût), hors tuiles de ressources. | Signe inversé à l'affichage. |
| Version des parseurs (13.3) | Scope 13 : Ruling : `PARSER_VERSION` inchangé, aucun événement stocké ne change de sens. | Aucun : `anomaly_action` n'existait pas avant. |

### Scope 12 — Transports

| Sujet | Décision | Coût si faux |
|---|---|---|
| Identité et coordonnées de l'autre joueur | **Remplacée le 2026-11-12 par une décision utilisateur.** Scope 12 : Ruling : l'événement `transport` ne porte ni identité ni coordonnées du partenaire ; ces données restent dans le brut, en attendant la réponse ToolDev sur les données d'autres joueurs (`docs/pts-captures.md`, section forum). | Une vue par partenaire demandera un `reparse`. |
| Type 34 | Scope 12 : Ruling : plus collecté (arrivées de flotte : retours et mouvements entre ses propres planètes, jamais un échange) ; le brut déjà stocké est conservé. | Aucun. |
| Arrivées de flotte (34) déjà stockées | **Complétée le 2026-11-12 par une décision utilisateur (tâche 10.3).** Aucune donnée stockée : aucun serveur n'a encore été configuré et aucun client n'est diffusé ; rien n'est fait côté serveur. | Sur une instance qui en aurait stocké, le compteur de non reconnus est gonflé ; corriger alors en ignorant à l'ingestion les types non suivis. |
| Transports internes | Scope 12 : Ruling : les transports entre ses propres planètes sont parsés en événements `internal`, comptés nulle part, et ne gonflent donc plus le nombre de messages non reconnus. | Aucun. |

## Écart noté

Le design §6.4 prévoit la lecture et l'écriture des réglages par l'API ; le plan ne prévoit que la lecture (dans la réponse de stats). Aucune écriture par l'API dans le MVP.

## En attente côté utilisateur

- Réponses ToolDev sur le fil forum (masquage d'OGLight, données d'autres joueurs dans les rapports de combat, fond sombre des fenêtres réglages et détail).
- Anomalies (scope 13) : réponse de `collectRewards` avec bonus de lithium, message 76 avec une récompense autre que ressources ou vaisseaux (si l'occasion se présente) (liste à jour dans `docs/pts-captures.md`).
- Installer la GitHub App Codecov (facultatif).
- Réactiver CodeQL dans le ruleset après le premier merge `develop` → `main`.
