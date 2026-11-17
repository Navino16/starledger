# Dashboard par univers dans l'app web — conception

Date : 2026-11-17. S'appuie sur la spec fonctionnelle (§7, §8, §13), le front web ([`2026-11-16-web-front-design.md`](2026-11-16-web-front-design.md)), le guide visuel ([`docs/web-design.md`](../../web-design.md)) et la fenêtre détail du userscript ([`2026-11-12-details-dashboard-design.md`](2026-11-12-details-dashboard-design.md)).

## Intention
L'app web n'a encore que des pages de compte. Le joueur veut **des graphiques de ses stats** par univers, consultables sur PC et téléphone, en complément de la fenêtre détail du userscript, qui reste un tableau.

Réussi si : en ouvrant le site, on voit d'un coup d'œil le bilan de la période choisie pour un compte (chiffres clés, évolution jour par jour, résultats d'expédition, gains et pertes par catégorie, vaisseaux), avec les mêmes chiffres que la fenêtre détail.

## Objectifs
- Un onglet **Dashboard**, premier du menu et page d'arrivée après connexion (`/dashboard` ; `/` y redirige).
- Un **sélecteur de compte** (univers + joueur) et une **barre de période** reprenant celle du userscript : Jour, Semaine, Mois, Tout, avec navigation ‹ mois ›.
- Cinq blocs, décidés avec l'utilisateur :
  1. **Chiffres clés** : métal, cristal, deutérium, antimatière, artefacts, bilan MSU, carburant connu.
  2. **Bilan MSU par jour** : une barre par jour du mois affiché, gain au-dessus et perte en dessous de zéro.
  3. **Résultats d'expédition** : nombre et pourcentage par résultat.
  4. **Gains et pertes par catégorie** : expéditions, combats, recyclage, champs d'épaves, anomalies, carburant.
  5. **Vaisseaux trouvés et perdus**, par type.
- Les données partielles sont signalées (rapports non reconnus, conflits, carburant inconnu).
- Interface en français et en anglais, utilisable au téléphone.

## Non-objectifs
- Journal des événements et recherche, comparaison de périodes, pages détaillées par catégorie, période personnalisée, objectifs, annotations (spec §13) : chantiers suivants.
- Vue multi-univers consolidée (spec §14).
- Aucun nouveau calcul de stats : tout chiffre vient de `computeStats` (`packages/shared/src/stats.ts`), comme pour le userscript. Le front ne fait que mettre en forme (pourcentages, conversion MSU d'une ligne déjà fournie).
- Pas de changement du userscript ni de `/api/v1`.

## Anti-objectifs
- Additionner des unités différentes (ressources, antimatière, artefacts, vaisseaux, expérience) dans une même valeur. Seule exception, déjà admise par la fenêtre détail : la valorisation MSU, toujours libellée « MSU ».
- Afficher 0 là où la valeur est inconnue (spec §12) : un carburant inconnu reste signalé comme tel.
- Charger une ressource externe (CDN, police, images du jeu) : les icônes du jeu ne sont pas reprises ici, les couleurs de ressources suffisent.
- Une requête au serveur du jeu : le dashboard ne lit que la base Starledger (AGENTS.md §4 ne s'applique pas, aucune activité de jeu).
- Du code illisible pour la revue de tolérance : notre code reste non minifié ; Recharts est inclus tel que publié.

## Contraintes
- Style et tokens de `docs/web-design.md` : couleurs de ressources pour les séries, `gain` / `danger` pour les barres de gain et de perte, axes en mono `muted`, grille en pointillés `line`, pas d'animation (le guide n'anime que couleurs, fonds et bordures). Chaque graphique a un résumé textuel (`role="img"` + `aria-label`).
- La page prend toute la largeur du conteneur de 1200 px (`is-wide` des maquettes) ; une seule colonne sous 640 px.
- Une requête de stats par changement de compte, de période ou de mois, jamais en boucle ni sur minuterie.
- Dépendances : règle du projet (`npx npm-check-updates`, dernière version).

## Approches considérées
1. **Recharts — retenu par l'utilisateur.** Axes, infobulles, légendes et redimensionnement fournis ; ajouter un graphique coûte peu pour les chantiers suivants. Coût : environ 400 Ko de plus dans un bundle non minifié, une partie de d3, et des styles par défaut à contourner pour coller au guide.
2. Composants SVG maison, comme le calendrier et le donut du userscript (recommandé par le rédacteur) : aucune dépendance, code court, style exact ; mais axes, graduations et infobulles à écrire, et à reprendre si les graphiques se compliquent.
- Écartés : bibliothèques en canvas (Chart.js, ECharts), moins accessibles et plus dures à styler ; ECharts est très lourd.

## Décisions prises

### Serveur
- `GET /api/site/accounts` : les comptes suivis de l'utilisateur, `{ serverId, lang, playerId, playerName }`, triés par univers puis joueur. Session obligatoire, comme le reste de `/api/site`.
- `GET /api/site/stats` : mêmes paramètres et même réponse que `GET /api/v1/stats` (`serverId`, `lang`, `playerId`, `period` parmi `day`, `week`, `month`, `all`, `today`), authentifié par la session. Il réutilise `getStats` et le schéma de requête existants, sans les dupliquer. `custom` reste accepté mais le front ne l'utilise pas encore.
- Un compte d'un autre utilisateur se comporte comme un compte inconnu (réponse vide), comme `/api/v1/stats`.

### Sélection du compte et de la période
- Le sélecteur liste les comptes : « Univers 285 (fr) · Orion » (« Joueur 123 » si le nom est inconnu).
- Compte, période et jour de référence sont dans l'URL (`/dashboard?account=285-fr-123&period=month&day=2026-11-17`), pour recharger ou partager son propre lien. Sans paramètre : le dernier compte choisi (mémorisé dans le navigateur), sinon le premier de la liste ; période Mois ; jour de référence aujourd'hui.
- **Aujourd'hui** est la date locale du navigateur (décision du rédacteur). Les jours des événements sont en heure du serveur OGame ; l'écart ne touche que les heures autour de minuit, et le site ne connaît pas le décalage du serveur.
- Navigation ‹ › : décale le jour de référence d'un mois (Mois, Tout), d'une semaine (Semaine) ou d'un jour (Jour). Le titre de la page nomme la période : « Novembre 2026 », « Semaine du 16 nov. 2026 », « 17 nov. 2026 », « Tout l'historique ».
- Clic sur une barre du graphique journalier : la période devient ce jour, comme le calendrier du userscript.
- Aucun compte suivi : un texte explique que le dashboard se remplit une fois que le userscript a envoyé des données (même principe que `settings.none`).

### Les blocs
- **Chiffres clés** (`summary.tiles`, `summary.fuel`) : une rangée de cartes ; le carburant affiche la dépense enregistrée et, si `fuel.unknownCount > 0`, « + N départs inconnus ». Le bilan MSU est signé (signe moins typographique).
- **Bilan MSU par jour** (`days`) : barres verticales, une par jour du mois du jour de référence, quel que soit la période (comme le calendrier du userscript) ; le jour ou la période sélectionnés sont mis en évidence. Infobulle : date et MSU du jour.
- **Résultats d'expédition** (`summary.expeditions.outcomes`) : liste à barres horizontales neutres avec pastille, nombre et pourcentage, triée par nombre décroissant, total en tête (maquette `dashboard.html`). Couleurs des pastilles : celles du donut du userscript, qui entrent dans le thème à cette occasion.
- **Gains et pertes par catégorie** (`summary.balance`, valorisé en MSU avec les réglages de l'univers renvoyés par la réponse) : barres horizontales divergentes, gain à droite en `gain`, perte à gauche en `danger`, une ligne par catégorie non vide. Infobulle : métal, cristal, deutérium bruts de la ligne.
- Quand l'univers inclut les échanges dans le bilan (`settings.includeTradesInBalance`), une ligne « Échanges » s'ajoute (`summary.trades` : reçus en gain, livrés en perte), comme la ligne `trades` de la fenêtre détail, pour que les lignes correspondent au bilan MSU (décision du rédacteur). Les arrondis de chaque ligne peuvent laisser un léger écart avec la tuile.
- **Vaisseaux trouvés et perdus** (`summary.ships`) : barres horizontales par type de vaisseau, trouvés et perdus côte à côte, en nombre de vaisseaux (pas en MSU). Types sans mouvement masqués.
- **Données partielles** : un bandeau discret au-dessus des blocs si `counts.unrecognized`, `summary.conflictCount` ou `fuel.unknownCount` sont non nuls, avec ces nombres. Les rapports non reconnus sont comptés sur tout l'historique du compte (`getStats` ne les filtre pas par période, et beaucoup n'ont pas de jour) : le bandeau le dit (« N rapports non reconnus dans tout l'historique »), sans changer le serveur (décision du rédacteur).
- Bloc sans donnée sur la période : la carte reste, avec « Aucune donnée sur cette période ».
- Disposition bureau : chiffres clés sur toute la largeur ; puis bilan journalier (2/3) et résultats d'expédition (1/3) ; puis gains et pertes (2/3) et vaisseaux (1/3). Téléphone : tout en une colonne, chiffres clés sur deux colonnes.

### Sécurité (revue du 2026-11-17)
- Toutes les réponses de `/api/site` portent `Cache-Control: no-store`, posé une fois dans le plugin : stats et comptes sont privés et dépendent du cookie.
- `/api/site/stats` a une limite de requêtes par utilisateur, comme `/api/v1` : `period=all` recalcule tout l'historique.
- `/api/site/accounts` ne liste que les comptes de l'utilisateur de la session ; un test vérifie que deux utilisateurs ne voient pas leurs comptes respectifs (spec §12).
- `/api/site/stats` réutilise le schéma de requête de `/api/v1/stats` sans l'assouplir ; un paramètre invalide répond 400 `invalid_payload`, jamais 500.
- Nom du joueur, libellés et valeurs ne sont rendus qu'en texte React (infobulles Recharts et `aria-label` compris), jamais en HTML brut.
- Un `account` inconnu ou mal formé dans l'URL est ignoré (premier compte). L'URL ne porte aucun secret.
- Recharts : version épinglée par le lockfile, `pnpm audit` à l'installation, aucune ressource chargée à l'extérieur.
- Hors de ce chantier : les en-têtes de sécurité de toute l'app (CSP, `frame-ancestors`, `nosniff`) font l'objet d'un scope séparé du plan.

### Formats
- Nombres : format de la langue, unités k, M, G comme le userscript (`apps/userscript/src/ui/format.ts`) ; dates courtes du guide.

## Laissé au constructeur
- Découpage en composants, gestion des requêtes côté React, et façon de contourner les styles par défaut de Recharts.
- Mise en œuvre des tests de graphiques sous jsdom (Recharts mesure ses conteneurs : `ResizeObserver` absent de jsdom).
- Libellés exacts des catégories et des résultats (reprendre ceux du userscript quand ils existent).
- Libellés des noms de vaisseaux (reprendre la table du userscript ou de `packages/shared`).
- Ordre des tâches et découpage en scopes du plan.
