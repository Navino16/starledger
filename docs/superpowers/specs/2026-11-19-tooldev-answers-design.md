# Réponses ToolDev : panneau dans la zone de contenu et données des autres joueurs

Date : 2026-11-19. Source : la réponse du ToolDev RiV- sur le fil 598 du forum Development (2026-11-18), aux questions du design MVP §9.4. Décisions de l'utilisateur du 2026-11-19.

## 1. Les réponses et leurs conséquences

| Question | Réponse | Conséquence |
|---|---|---|
| Masquer l'encart d'un autre outil toléré (OGLight) | « We do not care about that, that's your business with OGLight. » | Hors du champ d'Origin. La fonctionnalité reste ; le marqueur `GRAY AREA` est remplacé par un commentaire de conformité qui cite la réponse. |
| Données d'autres joueurs dans les combats bruts | Lire les règles (Forbidden features, règles du jeu, CGU) ; le RGPD et la protection des données sont de la responsabilité du développeur. | Pas d'arbitrage. Décision de l'utilisateur : retirer côté client les identifiants des autres joueurs avant l'envoi (§3). |
| Fenêtre avec un fond plein écran | « If you have an alternative that you know will not break any rules, why even ask? » | Pas un accord. `AGENTS.md` §0 « dans le doute, interdit » : le fond est supprimé (§2). |

Le message était retenu parce qu'il contenait un lien vers le code source, pas encore toléré. L'utilisateur retire le lien ; la question des icônes du jeu (design MVP §9.4, point 4) reste à poser.

## 2. Panneau dans la zone de contenu (Ruling M2, avec une option de position)

Les réglages (consentement compris) et le détail des stats ne s'ouvrent plus sur un fond plein écran. Ils s'ouvrent dans un panneau **dans le flux de la zone de contenu du jeu**.

- **Hôte** : `#contentWrapper`, sinon `#middle`, sinon juste après l'encart (comme la Ruling M2, `docs/decisions.md`). Les deux identifiants sont à vérifier sur le PTS (scope 10).
- **Position** : nouvelle option du client, *Position du panneau* : **au-dessus** du contenu du jeu (inséré en tête de l'hôte, par défaut) ou **en dessous** (ajouté à la fin). Stockée avec les autres options du client.
- **Jamais** par-dessus la barre du haut, le menu de gauche (Marchand, Recruter des officiers, Boutique), les bannières, la barre de pub ni le footer ; pas de calque, pas de `position: fixed`, pas de changement d'opacité (`AGENTS.md` §1.7). Tant que le panneau est ouvert, le contenu du jeu descend (au-dessus) ou le panneau le suit (en dessous).
- **Largeur** : celle de l'hôte (environ 670 px sur desktop au lieu de 880 px). La mise en page du détail s'adapte : les deux cartes côte à côte passent l'une sous l'autre quand la place manque.
- **Ouverture** : uniquement sur un clic du joueur ; à l'ouverture, le panneau est amené dans la vue (`scrollIntoView`, bloc `nearest`). C'est un défilement de la page, pas une action de jeu.
- **Fermeture** : bouton de fermeture ou Échap ; pour le détail seulement, aussi un clic hors du panneau. À la fermeture, le nœud et tous ses écouteurs sont retirés et la page revient à son état précédent.
- Un seul panneau à la fois, comme aujourd'hui.

## 3. Données des autres joueurs

### 3.1 Règle

Avant qu'une observation quitte la machine du joueur, le client retire les identifiants des **autres** joueurs : identifiants et noms de joueur, alliances, identifiants et noms de planète ou de lune. Ce qui concerne le joueur lui-même reste intact.

On garde, parce que les parseurs en ont besoin et que cela décrit la propre flotte du joueur :
- le lieu du combat (`coords`) et les coordonnées de `defenderspaceobject`, qui servent aux combats d'expédition en position 16 ;
- la composition des flottes adverses (`combatTechnologies`, rounds), qui sert aux combats de sondes seules et à la réinterprétation.

### 3.2 Par type de message

`own` est `observation.account.playerId`.

| Type | Retiré quand ce n'est pas `own` |
|---|---|
| 25 combat | dans `fleets[]` : `player`, `spaceObject` et `combatResearchPercentage` de chaque entrée dont `player.id` n'est pas `own` ; `defenderspaceobject` réduit à `{ type, coordinates }` quand son type n'est pas `anomaly` et que `owner.id` n'est pas `own`. Un attribut qui n'est pas du JSON valide est retiré (le serveur déclare alors le message non reconnu). |
| 48 combat en un round | `targetplanetid`, `targetplanetname` (le propriétaire n'est pas dans le message). `targetplanetcoordinates` est gardé. |
| 33 transport | pour chaque côté (`source`, `target`) dont `playerid` n'est pas `own` : `playerid`, `playername`, `planetid`, `planetname`, `planetcoordinates`, `planettype`, `planeticon`. |
| 76 récompense d'anomalie | `targetplayer*` et `targetplanet*` quand `targetplayerid` n'est pas `own`. |
| tout type | en filet de sécurité, tout attribut `*playername` dont le `*playerid` associé est absent ou n'est pas `own`. |

### 3.3 Où

- Une fonction pure `redactObservation(obs)` dans `packages/shared`, idempotente, testée sur les vraies fixtures.
- Le userscript l'applique quand il construit une observation, puis juste avant l'envoi, pour nettoyer aussi les observations mises en file par une version précédente.
- **Côté client seulement** (décision de l'utilisateur) : le serveur ne nettoie pas et ne migre pas ce qu'il stocke déjà.

### 3.4 Conséquences

- **Événement transport** : `partner` est retiré de `TransportEvent` ; le sens (`internal`, `delivered`, `received`) vient du côté qui porte `own`. Un côté sans identifiant de joueur compte comme « pas `own` » ; un message sans côté `own` reste non reconnu. Remplace la décision du 2026-11-12 sur le partenaire des transports.
- Les événements déjà stockés gardent leur `partner` jusqu'à un `reparse` ; rien ne le lit.
- L'écran de consentement dit que les noms et identifiants des autres joueurs sont retirés avant l'envoi, et que les coordonnées des combats et la composition des flottes adverses sont gardées. Même texte dans le dossier de tolérance et `docs/privacy.md` (scope 14).

## 4. Hors périmètre

- Nettoyage côté serveur et migration des observations stockées (décision de l'utilisateur : client seulement).
- Toute modification des stats.
