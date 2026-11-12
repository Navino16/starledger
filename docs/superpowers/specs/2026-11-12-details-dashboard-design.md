# Fenêtre « Détail » façon OGLight — design

Date : 2026-11-12. Remplace la mise en page du détail décrite au design MVP §5.6 (« Détail au clic »). Les règles de calcul (§5.6 « Règles de calcul des tuiles ») ne changent pas, sauf mention contraire.

## Intention

La fenêtre de détail actuelle est illisible : une même case mélange métal, cristal et deut, les lithium et découvertes sont des phrases, les résultats et vaisseaux sont des listes. L'utilisateur compare ses chiffres à OGLight et veut **la même lecture en grille** : un chiffre par case, une colonne par ressource avec l'icône du jeu, les couleurs du jeu, les vaisseaux en vignettes, les résultats d'expédition en donut, et la navigation par jour, semaine, mois et total avec un calendrier du mois.

Réussi si : en ouvrant le détail, on lit d'un coup d'œil le bilan de la période choisie, catégorie par catégorie, comme dans OGLight, sur PC comme sur téléphone.

## Objectifs

1. Reprendre la structure de la fenêtre d'OGLight (capture de référence du 2026-11-12) :
   - barre de période **J / S / M / Tout**, avec navigation **‹ mois ›** ;
   - **calendrier du mois** : une barre par jour, cliquable ;
   - **donut** des résultats d'expédition avec légende (nombre et pourcentage) ;
   - **grille des vaisseaux** en vignettes ;
   - **tableau** : une ligne par catégorie, une colonne par grandeur, une ligne Total.
2. **Icônes du jeu** pour les ressources, les vaisseaux et le lithium (voir Contraintes).
3. Utilisable sur téléphone : la fenêtre tient dans la largeur, le tableau défile horizontalement avec la première colonne fixe, le donut et la grille des vaisseaux passent l'un sous l'autre.

## Non-objectifs

- Pas de nouveau calcul de stats : tout chiffre affiché vient du serveur (design MVP §5.6 « Le client ne calcule aucune stat lui-même »), à l'exception de la mise en forme et des pourcentages du donut.
- Pas de refonte de l'encart (fait le 2026-11-12, PR #46).
- Pas de ligne « Moyenne / jour » (retirée de la maquette, réintroductible plus tard).
- Le calcul des combats et des champs d'épaves (ce qui est compté, et comment le jeu le reporte) est un **sujet séparé**, à revoir avec un vrai rapport en jeu ; ce design ne le change pas.

## Anti-objectifs (échec même si ça marche)

- Additionner des unités différentes (ressources, AM, artefacts, lithium) dans une même case. Seule exception voulue : la valeur des vaisseaux convertie en ressources, comme les tuiles.
- Afficher 0 là où la valeur est inconnue : une valeur partielle garde son marqueur `+ ? (n)`.
- Une requête de plus au serveur du jeu (AGENTS.md §4) : les icônes sont des images statiques du CDN de Gameforge ou les composants du jeu déjà chargés.
- Une interface qui imite ou masque le jeu (AGENTS.md §1.5, §1.7) : c'est une fenêtre de stats ouverte par un clic du joueur, comme aujourd'hui.

## Contraintes

- Userscript sans dépendance d'interface (DOM natif, SVG écrit à la main pour le donut et le calendrier).
- La fenêtre reste celle d'aujourd'hui (fenêtre centrée sur fond sombre, ouverte par un clic, décision du 2026-11-12, GRAY AREA AGENTS.md §1.7 déjà signalée).
- **Icônes** (décision utilisateur) : celles du jeu, comme OGLight.
  - En priorité les composants que le jeu utilise déjà dans ses pages : `<resource-icon class="metal|crystal|deuterium" sq16|sq26>`, `<technology-icon transportersmall>` (attribut = nom technique du vaisseau, table `SHIP_TECH_NAMES`), `<lithium-icon sq16>`. Ils ne s'affichent que dans les pages du jeu.
  - En secours (composant non défini sur la page, ou AM et artefacts pour lesquels aucun composant n'a été vu) : les images du CDN de Gameforge qu'utilise OGLight (sprite des ressources `gf3.geo.gfsrv.net/cdned/7f14c18b15064d2604c5476f5d10b3.png`, une image par vaisseau, adresses relevées dans la capture du 2026-11-12). Un commentaire de conformité indique que ce sont des images statiques, sans activité de jeu.
  - Icône des artefacts : à trouver sur le PTS (par exemple dans un message de découverte de forme de vie). À défaut, celle d'OGLight.
- **Couleurs** : celles des ressources dans le jeu, déjà dans `ui/styles.ts` ; perte en rouge.
- Formats de nombres : ceux de `ui/format.ts` (`k`, `M`, `G`).

## Ce qui est décidé

### Période et navigation

- Boutons **J, S, M, Tout** (libellés traduits) ; **‹ mois ›** change le mois affiché par le calendrier.
- Le **calendrier** montre les jours du mois affiché, une barre par jour. Hauteur proportionnelle au **MSU net du jour** (barre rouge si négatif, à ma charge), jour sélectionné encadré.
- Clic sur un jour : la période devient ce jour (J). S : la semaine du jour sélectionné ; M : le mois affiché ; Tout : tout l'historique (le calendrier reste affiché pour naviguer).
- **Serveur** : il faut une série par jour pour le mois affiché (aujourd'hui l'API ne renvoie qu'un résumé de période). Forme laissée au constructeur (nouvel endpoint ou champ de `StatsResponse`), contrainte : une seule requête au serveur Starledger par ouverture ou changement de mois, jamais en boucle.

### Donut

- Résultats d'expédition de la période (`expeditions.outcomes`), une couleur par résultat, légende avec nombre et pourcentage, total au centre. Mêmes résultats et libellés qu'aujourd'hui (`OUTCOME_KEYS`).

### Grille des vaisseaux

- Une vignette par type de vaisseau, dans l'ordre des ids, avec le **nombre trouvé** (blanc) et, s'il y en a, le **nombre perdu** en dessous en rouge (`-n`), toutes catégories confondues. Vaisseaux à 0 trouvé et 0 perdu : affichés à 0, comme OGLight (à ma charge).

### Tableau

- Colonnes : nombre d'événements, métal, cristal, deut, MSU, AM, artefacts, lithium. En-têtes : icônes, libellé en infobulle.
- Lignes : Expéditions, Combats, Recyclages, Champs d'épaves, Anomalies, Découvertes, Carburant, puis Échanges si `includeTradesInBalance` est actif, puis **Total**.
- Une case sans objet affiche `-` ; une valeur partielle garde `+ ? (n)`.
- **Ressources et vaisseaux** (décision utilisateur, option A) : les colonnes métal, cristal et deut reprennent les valeurs du serveur, vaisseaux convertis compris (trouvés ou récupérés selon `expeditionShipRatio` / `anomalyShipRatio`, perdus à leur coût), comme OGLight et les tuiles ; la ligne Total est égale aux tuiles. Une infobulle sur les lignes concernées indique que la valeur des vaisseaux est incluse.
- **Combats** (décision utilisateur) : on ne gagne jamais de vaisseaux en combat ; le butin compte en positif, les vaisseaux perdus en négatif (dans les colonnes converties, le MSU et sous les vignettes).
- **Lithium** : colonne propre, renseignée pour Anomalies et Total ; jamais additionnée aux ressources.
- **AM payée** pour les anomalies : en négatif dans la colonne AM de la ligne Anomalies, sans toucher à la tuile AM de l'encart (décision du 2026-11-12).

### Informations conservées hors du tableau

Ce que le détail actuel affiche et que la grille ne montre pas reste accessible, en infobulle ou sous le tableau (choix précis laissé au constructeur) : carburant inconnu (nombre de départs), lithium dépensé / remboursé / inconnus, issues des combats (gagnés, perdus, nuls), XP des découvertes, nombre de messages non reconnus, échanges non inclus dans le bilan.

## Choix de l'assistant (à relire par l'utilisateur)

- **Une case = un net** (gains − pertes) de la catégorie ; le MSU d'une ligne est ce net converti avec le ratio MSU. La ligne Total reprend exactement les tuiles de l'encart (métal, cristal, deut, AM, artefacts, MSU) : un écart d'arrondi entre la somme des lignes MSU et le Total est accepté.
- **AM payée pour les anomalies** : pas dans la colonne AM (le Total AM doit rester égal à la tuile, qui ne la déduit pas) ; affichée en infobulle de la ligne Anomalies et dans les informations sous le tableau.
- **Colonne « nombre »** : nombre d'événements de la catégorie ; pour Carburant, le nombre de départs.
- **Découvertes** : `-` dans les colonnes de ressources et MSU ; artefacts dans sa colonne ; XP hors tableau.
- **Total lithium** : le net (remboursé − dépensé), avec ses marqueurs d'inconnus.
- **Le serveur fournit le découpage par ligne** (net par ressource, AM, artefacts, nombre) : le client ne fait aucun calcul de stats. Champs ajoutés à `StatsSummary` au choix du constructeur.
- **Période** : le paramètre de date de référence actuel (`today`) sert aussi de jour sélectionné ; J, S et M sont calculés autour de lui, ce qui permet les mois passés sans nouvel endpoint de période.
- **Série par jour** : MSU net de chaque jour du mois affiché, calculé comme la tuile MSU de ce jour (négatif possible), dans la même réponse ou un endpoint dédié ; une requête au serveur Starledger par changement de période ou de mois, déclenchée par un clic du joueur. « Tout » ne charge pas l'historique jour par jour.
- **Grille des vaisseaux** : les vaisseaux de `SHIP_TECH_NAMES`, dans l'ordre des ids, même à 0 ; « perdus » = toutes les pertes constatées (expéditions, combats, anomalies), indépendamment de `ignoreExpeShipsLoss`, qui ne change que la valorisation.
- **Échanges** : ligne présente seulement si `includeTradesInBalance` est actif ; sinon une note sous le tableau donne reçus, envoyés et net.

## Laissé au constructeur

- Forme de l'API par jour, et calcul côté serveur.
- Détails de mise en page, tailles, ordre des légendes.
- Où placer chaque information conservée hors du tableau.
- Découpage en tâches et tests (jsdom : structure, valeurs, marqueurs ; pas de test de rendu visuel).

## Validation

- Après implémentation, et avant le merge : vérification par l'utilisateur sur le PTS ; ajustements éventuels (icônes artefacts et lithium, mise en page) dans la même branche.
