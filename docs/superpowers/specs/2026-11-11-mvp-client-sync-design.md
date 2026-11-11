# MVP — client de collecte et synchronisation : conception

Date : 2026-11-11 · Statut : à valider
Référence fonctionnelle : [`docs/spec-fonctionnelles.md`](../../spec-fonctionnelles.md) (ci-après « spec »).
Nom du projet : **Starledger** (dépôt `Navino16/starledger`, public).

## 1. Intention

Dans OGame, les messages sont effacés 24 h après leur lecture. OGLight et OGame Tracker ne mémorisent que ce que **leur** appareil a lu. Pour garder des stats complètes, le joueur doit aujourd'hui passer sur chaque appareil (PC, mobile Android) et chaque compte avant l'effacement des messages. C'est long et pénible, surtout le week-end.

Le projet donne **un point unique pour les stats**. Chaque appareil envoie ce qu'il lit à un serveur commun, au moment où il le lit. Un rapport lu une seule fois, sur n'importe quel appareil, est acquis pour toujours et compté une seule fois.

Le MVP couvre **toute la partie client** et le strict nécessaire côté serveur pour la faire fonctionner.

## 2. Objectifs, non-objectifs, anti-objectifs

### Objectifs du MVP
1. **Collecte dans le jeu**, avec le même comportement qu'OGLight et OGame Tracker : expéditions, combats, recyclages, découvertes de formes de vie (FdV). La règle d'arbitrage entre les deux est au §5.
2. **Collecte des anomalies**, une nouvelle fonctionnalité d'OGame que ni OGLight ni Tracker ne gèrent : lithium dépensé, récompenses et remboursements (cashback).
3. **Suivi du carburant** (deutérium) des départs de flotte confirmés.
4. **Synchronisation automatique** vers le serveur, avec une file locale résistante aux coupures et sans double comptage.
5. **Encart de stats dans le jeu**, équivalent à celui d'OGLight, alimenté par les stats **partagées** du serveur.
6. **Options du client** : URL du serveur, clé API, masquage de l'encart OGLight.
7. **Serveur minimal** : utilisateurs, invitations, clés API, réception des événements, calcul des stats de l'encart, quelques pages web minimales.
8. **Dossier de tolérance OGame** prêt à déposer (§4.1).

### Non-objectifs du MVP (prévus plus tard)
- Le dashboard détaillé par univers (spec §8).
- Les imports et exports OGLight, Tracker et natif (spec §10).
- Toutes les fonctions de la spec §13 et §14.
- Le suivi de la production : conversions de ressources en lithium et production de ressources en général. C'est un chantier séparé.
- La gestion des appareils, le partage et la suppression fine des données.
- L'inscription libre (seulement un interrupteur, désactivé par défaut).
- Les notifications et bilans envoyés hors du jeu (spec §13 « Bilans périodiques »). Une notification déclenchée automatiquement par un événement du jeu est **interdite** (`AGENTS.md` §1.4). Tout canal externe devra être validé par un ToolDev.

Le modèle de données doit malgré tout permettre ces évolutions sans migration douloureuse (§6.3).

### Anti-objectifs (échec même si « ça marche »)
- **Perdre la tolérance OGame**, ou faire bannir un compte de joueur : appels réseau au jeu en arrière-plan, automatisation, envoi de données sans consentement.
- **Compter deux fois** un même rapport ou un même départ, que ce soit entre appareils, après une relecture ou après une coupure.
- **Afficher une donnée inconnue comme une valeur zéro certaine.**
- Déplacer les gains d'un vieux rapport vers le jour où il a été lu.
- Laisser un utilisateur voir les données d'un autre.
- Gêner le jeu quand la clé est invalide ou le serveur injoignable.

## 3. Contexte et recherches

### 3.1 OGLight (userscript, v5.5.0, Greasy Fork #514909)
- **Licence MIT**, © 2019 Oz. On peut reprendre du code tel quel en gardant la mention de copyright. Il est **interdit d'utiliser le nom ou la marque OGLight**.
- **Lecture des messages** : un hook `ajaxSuccess` sur `action=getMessagesList`. Le script relit ensuite `ogame.messages.content`. Pour chaque `.msg`, il récupère `data-msg-id` et le dataset de `.rawMessageData`, c'est-à-dire les attributs `data-raw-*`.
- **Types de messages** : 41 expédition, 61 découverte FdV, 25 combat, 48 combat en un round, 32 recyclage, 54 champ d'épaves.
  - En position 16, un combat (25/48) est rangé comme combat d'expédition (pirates ou aliens), et un recyclage (32) comme débris d'expédition.
- **Dates et doublons** : la date utilisée est celle de l'événement (`data-raw-timestamp`). Le regroupement par jour se fait **à l'heure du serveur OGame**. Pour éviter les doublons, le script garde la liste des identifiants de messages déjà vus, jour par jour.
- **Carburant** : le script remplace `fleetDispatcher.submitFleet2`. Quand l'envoi réussit, il ajoute `getConsumption()`, plafonné au deutérium présent sur la planète. Il ne fait aucun dédoublonnage et ne compte pas les envois depuis la vue galaxie.
- **Encart** : `.ogl_miniStats`, sous `#links`. Il montre **la journée en cours** en 6 tuiles : métal, cristal, deut, AM, artefacts, MSU.
  - Un clic ouvre le détail : jour, semaine, mois, total, barres MSU par jour, anneau des résultats d'expédition, tableau des vaisseaux et récapitulatif (expéditions, raids, consommation, moyenne, total).
  - Le MSU est configurable (3:2:1 par défaut).
  - **Aucune option ne permet de masquer l'encart** : `displayMiniStats` existe dans le code mais ne sert plus.
- **Stockage** : uniquement des **agrégats par jour**, pas d'événements individuels.

### 3.2 OGame Tracker (extension, github.com/ogametracker/ogame-extension, maintenue)
- **« All Rights Reserved »**, sans licence. **Aucun code ni aucune icône ne peut être copié.** On peut seulement s'en inspirer et réécrire. Les noms d'attributs OGame restent utilisables, puisque ce sont des faits sur le jeu.
- **Lecture des messages** : un MutationObserver surveille `.messagesHolder` et lit les `data-raw-*` des messages.
- **Identité** :
  - Un rapport est identifié par `data-msg-id`, pour un compte donné.
  - Un compte est identifié par les balises meta `ogame-universe` (`s{id}-{lang}`) et `ogame-player-id`.
- **Champs stockés par type de rapport** :
  - Expédition : `{date, type, size, depletion, resources | fleet | darkMatter | item}`. Pirates et aliens sont regroupés sous `combat`.
  - Combat : `{date, coords, result, isExpedition, loot signé, debrisField, lostShips}`. Les combats en un round sont ignorés, et les combats de sondes peuvent l'être.
  - Recyclage : `{date, metal, crystal, deut, isExpeditionDebrisField}`.
  - Découverte FdV : `{date, type, artifactsSize, artifactsFound, lifeform, xp}`.
- **Regroupement par jour** : à l'heure **du navigateur**.
- **Carburant** : pas suivi.

### 3.3 Règles OGame pour les outils (forum Origin)
- Règles d'outils interdits : https://forum.origin.ogame.gameforge.com/forum/thread/29-forbidden-features/
- Conditions de dépôt : https://forum.origin.ogame.gameforge.com/forum/thread/318-read-first-do-i-need-to-submit-my-tool-submission-guidelines/
- Modèle de dépôt : https://forum.origin.ogame.gameforge.com/forum/thread/332-tool-submission-template/
- `AGENTS.md` officiel pour les agents IA : https://github.com/Rivenscryr/origin-tooldev-agents
- Précédent proche (script qui envoie des stats d'expédition à un serveur externe, toléré) : https://forum.origin.ogame.gameforge.com/forum/thread/564-expedition-tracker-contribution-script/

Les conséquences de ces règles sont décrites au §4.1.

## 4. Contraintes

### 4.1 Tolérance OGame — contraintes dures
- **Le userscript et le serveur doivent être tolérés.** On dépose une version figée sur le forum Submissions & API Requests. Chaque version suivante doit avoir un changelog détaillé.
- **Développement et tests uniquement sur le PTS (Singularity, en_808)** tant que l'outil n'est pas toléré. Pas d'utilisation sur un compte réel avant la tolérance. Les captures HTML faites à la main sur un compte réel, sans le script, restent possibles.
- **Aucun appel au serveur du jeu en arrière-plan** : ni minuteur, ni boucle, ni requête différée. Le client se contente de :
  1. lire le DOM des pages que le joueur a ouvertes ;
  2. observer les réponses aux requêtes AJAX que le joueur a lui-même déclenchées (ouverture d'un onglet de messages, envoi d'une flotte, action sur la page des anomalies).

  Le client n'émet **jamais** de requête vers le jeu.
- **Observation strictement passive** : on écoute les réponses (`ajaxSuccess` ou équivalent en lecture seule).
  - Le client ne **remplace jamais** une fonction du jeu, alors qu'OGLight remplace `fleetDispatcher.submitFleet2`.
  - Il ne modifie, ne retarde et ne rejoue jamais une requête du joueur.
  - Si une donnée n'est disponible qu'en modifiant le déroulement du jeu, on la marque *inconnue*.
- **Pas d'automatisation** (règle « 1 clic = 1 action »), pas d'interface alternative, pas d'alarmes ni de notifications d'événements du jeu.
- **Consentement explicite et éclairé** avant tout envoi au serveur : un écran au premier lancement explique ce qui est envoyé et où. Sans consentement, rien n'est collecté ni envoyé.
- **Code lisible** : le `.user.js` publié n'est ni minifié ni obfusqué, **dépendances embarquées comprises**, et le code source est publié.
- **Ne pas toucher** aux bannières, à la monétisation et au footer du jeu. L'encart inséré sous `#links` ne doit **ni masquer, ni recouvrir, ni repousser hors de l'écran** les entrées Marchand, Recruter des officiers ou Boutique, ni la barre de publicité (`AGENTS.md` §1.7). C'est à vérifier aussi sur mobile.
- **Masquage de l'encart OGLight** : zone grise (`AGENTS.md` §3).
  - Le code est marqué `// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3`.
  - La fonctionnalité n'est pas déposée ni publiée sans accord **écrit** d'un ToolDev ; en cas de refus, elle est retirée.
  - La question se pose sur le forum Development (§9).
- Le fichier `AGENTS.md` officiel est **copié à la racine du dépôt** et référencé dans le `CLAUDE.md` du projet.
  - Son dépôt n'a pas de licence, mais l'auteur invite explicitement à faire cette copie dans le fil du forum.
  - On indique en tête du fichier la source et la date de la copie, et on le resynchronise avant chaque dépôt de tolérance.
- Les appels du client vers **notre** serveur ne génèrent pas d'activité dans le jeu. Par prudence face aux reviewers, ils suivent la même discipline :
  - ils partent **uniquement** au chargement d'une page, après une collecte ou à l'ouverture du détail ;
  - **aucun minuteur** : pas de `setInterval`, pas de nouvelle tentative différée avec backoff, pas d'interrogation en boucle ;
  - une file non vidée attend le prochain de ces moments.
- **Auto-audit** : la checklist de `AGENTS.md` §7 est déroulée à la fin de chaque scope qui touche le userscript, et ses résultats sont notés.

### 4.2 Licences
- Tracker : on ne copie rien.
- OGLight : la reprise de code MIT est permise avec attribution dans un fichier `THIRD_PARTY_NOTICES`. On préfère réécrire, et on n'utilise pas le nom.

### 4.3 Hébergement
- **Docker obligatoire**, sur le homelab de l'utilisateur.
- L'exposition sur internet (domaine, reverse proxy, HTTPS) est gérée par l'utilisateur. Le conteneur écoute en HTTP simple.
- Le serveur doit pouvoir fonctionner derrière un proxy (en-têtes `X-Forwarded-*`).

### 4.4 Plateformes clientes
- **Tampermonkey** sur Firefox desktop et sur Firefox Android.
- L'interface doit être utilisable sur un écran de téléphone.

## 5. Règles fonctionnelles décidées

### 5.1 Arbitrage OGLight / Tracker
1. **On stocke chaque événement** à part, comme Tracker. C'est indispensable pour le multi-appareils et pour les imports futurs.
2. **On collecte l'union de ce que collectent OGLight et Tracker** :
   - les types 41, 61, 25, 48, 32 et 54 ;
   - pour chaque type, tous les champs que l'un ou l'autre lit ;
   - pirates et aliens sont gardés **distincts** ;
   - les coordonnées sont conservées.
   - **En plus** (demande de l'utilisateur) : les **transports de ressources entre joueurs**, dans les deux sens (reçus d'un autre joueur, livrés à un autre joueur), pour suivre les échanges et les remboursements.
     - Les transports entre ses propres planètes sont exclus, en comparant les identifiants de joueur.
     - Le type de message et ses attributs `data-raw-*` restent à identifier sur des captures (§9).
3. Les **conventions d'OGLight** s'appliquent à l'encart et au découpage des journées : jour **à l'heure du serveur OGame**, semaine du lundi au dimanche, journée en cours par défaut.
4. **MSU** : un réglage **du serveur, par univers et par utilisateur**, 3:2:1 par défaut. Il ne modifie que la valorisation affichée, jamais les données collectées. L'encart lit ce réglage depuis le serveur.

### 5.2 Rapports collectés
- **Déclencheur** : le joueur affiche un onglet de messages. On lit les attributs `data-raw-*`, jamais le texte affiché.
- **Date de l'événement** : `data-raw-timestamp`. On enregistre aussi la date de lecture, à part.
- **Rapport au format inconnu ou non reconnu** : il est **signalé** (état « non reconnu », visible dans l'encart) et conservé à l'état brut. Il n'est jamais interprété au hasard.
- **Champs explicitement absents** (par exemple : pas de consommation connue) : on les stocke comme *inconnus*, jamais comme 0.

### 5.3 Carburant
On compte le carburant **exactement comme OGame le prélève** :
- Chaque mission est comptée **au moment où le départ est confirmé** par la réponse du jeu, quel que soit son type de mission.
- On garde avec la dépense : le type de mission, l'origine, la destination et la flotte si elle est disponible.
- Départs couverts :
  - ceux de la page d'envoi de flotte ;
  - **ceux de la vue galaxie** (`miniFleet` : sondes, recycleurs, etc.). Si la consommation ne peut pas être déterminée de façon fiable, la dépense est enregistrée comme *inconnue* et non comme 0.
- Un départ annulé ou en échec ne compte pas. Un coût affiché avant l'envoi n'est jamais enregistré comme une dépense.
- **Rappels** : à vérifier sur le PTS (§9).
  - Si OGame ne rembourse rien lors d'un rappel, le rappel ne modifie pas la dépense.
  - Si OGame rembourse, on suit le remboursement réel comme un événement distinct.
- **Un départ est compté une seule fois**, grâce à l'identifiant de flotte renvoyé par le jeu s'il existe. Sinon, on utilise une clé composite déterministe (§6.2).
- Pour les envois d'anomalies, rien de particulier : ils passent par l'envoi de flotte classique.

### 5.4 Anomalies
Cycle du jeu, sur une **page dédiée** :
1. **Scan** (ou rafraîchissement), payé en lithium.
2. **Choix** d'une anomalie : PvP ou PvE, livraison ou combat.
3. **Envoi** de la flotte demandée par l'envoi classique (le carburant est suivi par le §5.3).
4. **Fin de mission** : le joueur a 1 h pour **récupérer les récompenses** (ressources, vaisseaux), contre du lithium. Il reçoit parfois un **remboursement de lithium**.

Règles de suivi :
- **Chaque étape est un événement distinct** : scan, choix, récupération, remboursement. Ainsi, une anomalie scannée mais jamais faite, ou une récompense non récupérée, apparaît telle quelle.
- On affiche trois chiffres séparés : **lithium dépensé** (scans + récupérations), **lithium remboursé**, et **net**.
- Les récompenses (ressources, vaisseaux) sont comptées dans les gains, dans une catégorie « anomalies » à part.
- **Le DOM et les requêtes de la page des anomalies sont inconnus pour l'instant.** L'utilisateur fournira :
  - des captures HTML de la liste après un scan, de l'écran de récupération et des éventuels messages de fin ;
  - un HAR réseau de ces actions.

  Le parseur est conçu à partir de ces captures (§9). D'ici là, ce module reste en attente sans bloquer le reste.

### 5.5 Synchronisation
- Chaque observation est d'abord écrite dans une **file locale** (stockage `GM_*` de Tampermonkey), puis envoyée au serveur par lots.
- La file est vidée après une collecte, au chargement d'une page et à l'ouverture de l'encart. Le serveur confirme chaque élément, et seuls les éléments confirmés quittent la file.
- **Idempotence** : un renvoi ne crée jamais de doublon (§6.2).
- **États affichés** : *à jour* (avec l'heure), *N en attente*, *erreur* (avec un message clair : clé invalide, serveur injoignable, version du client trop ancienne).
- Si la clé est invalide ou le serveur injoignable, la collecte continue en local et le jeu n'est pas gêné.
- **Identité de l'appareil** : chaque installation du script génère un identifiant aléatoire, envoyé avec ses observations. Ça prépare la couverture par appareil et la gestion des appareils, prévues plus tard.

### 5.6 Encart dans le jeu
- Il s'affiche sur toutes les pages du jeu, à l'endroit habituel (sous `#links`), et doit rester utilisable sur mobile.
- Il montre les **stats partagées du serveur** pour **le compte et l'univers en cours**, **pour la journée en cours** (heure serveur).
- **Indicateurs de base** (inspirés d'OGLight) : métal, cristal, deut, AM, artefacts, MSU.
- **Indicateurs ajoutés** : carburant enregistré, avec sa couverture si elle est partielle, et lithium net des anomalies.
- Il indique la **fraîcheur** des données et ce qui est **en attente** d'envoi.
- **Détail au clic**, inspiré de la fenêtre d'OGLight :
  - sélection jour, semaine, mois ou total ;
  - répartition des résultats d'expédition ;
  - tableau des vaisseaux trouvés et perdus ;
  - récapitulatif par catégorie (expéditions, combats, recyclages, FdV, anomalies), avec les **gains, les pertes et le carburant affichés séparément** et le bilan net expliqué ;
  - signalement des données partielles ou non reconnues.
- **Unités séparées** : ressources, AM, vaisseaux, XP, artefacts et lithium ne sont jamais additionnés entre eux. Le MSU ne couvre que métal, cristal et deut, plus les vaisseaux valorisés à leur coût.
- **Événements en attente** : ils sont seulement **comptés** (« N en attente ») et ne sont pas ajoutés aux chiffres. Le client ne calcule aucune stat lui-même. *(Décision de conception.)*
- **Serveur injoignable** : l'encart affiche les derniers chiffres reçus, marqués comme anciens avec leur heure. *(Décision de conception.)*

#### Règles de calcul des tuiles — *décision de conception : reprendre les règles d'OGLight*
On reproduit le calcul d'OGLight, puisque c'est la référence à laquelle l'utilisateur compare.

**Gains comptés dans les tuiles métal, cristal, deut et AM :**
- ressources et AM trouvées en expédition ;
- recyclages en position 16 (débris d'expédition) ;
- butin des combats **gagnés en attaque** ;
- recyclages hors position 16 ;
- XP et artefacts des découvertes FdV, chacun dans sa tuile ;
- champs d'épaves (54) : vaisseaux récupérés.

**Ce qui vient en déduction ou ne compte pas :**
- un combat **perdu en défense** sur sa propre planète compte un butin négatif ;
- les combats ne comprenant que des sondes **sont comptés** comme les autres : sondes perdues dans les pertes, butin éventuel dans les gains. C'est un écart volontaire par rapport à OGLight, demandé par l'utilisateur. Ces combats restent identifiables pour un filtrage futur.
- les **débris créés** par un combat (25) sont stockés et affichés, **jamais comptés**. Seul le recyclage (32) compte, ce qui évite de compter deux fois.
- les combats en un round (48) comptent seulement pour leurs **pertes de vaisseaux**, sauf si ce ne sont que des sondes.

**Tuile MSU :**
- (gains − pertes de vaisseaux valorisées à leur coût − carburant enregistré), convertis en MSU ;
- les vaisseaux trouvés sont valorisés à leur coût.

**Réglages de valorisation, par univers et côté serveur :**
- comme dans OGLight : ratio MSU, % de valeur des vaisseaux trouvés (`expeditionShipRatio`), ignorer les pertes de vaisseaux en expédition, ignorer le carburant ;
- valeurs par défaut identiques à OGLight ;
- ces réglages n'apparaissent pas dans les options du client.

**Transports entre joueurs** — *décision de conception* :
- Une catégorie **« Échanges »** à part dans le détail, avec trois montants : reçu, envoyé et net, par ressource.
- Ils ne sont **pas ajoutés aux tuiles de gains par défaut**, parce qu'un échange n'est pas un gain d'activité.
- Un réglage serveur par univers permet d'inclure leur net dans le bilan, par exemple pour qu'un remboursement compense une perte.

**Anomalies :** une ligne à part dans le détail. Elles ne sont ajoutées aux tuiles que si leurs récompenses ne recoupent aucun rapport déjà compté (§9).

### 5.7 Options du client
- **URL du serveur**. Elle est configurable, pour qu'un tiers puisse héberger sa propre instance.
- **Clé API** : saisie, remplacement, retrait, avec un test de connexion qui affiche le résultat ou l'erreur.
- **Masquage réversible de l'encart OGLight** (CSS sur `.ogl_miniStats`), sous réserve du §9. Les autres fonctions d'OGLight ne sont pas touchées.
- **Consentement** à l'envoi des données, révocable.

### 5.8 Utilisateurs et accès
- Le service est **multi-utilisateurs dès le départ**, avec une isolation stricte : chaque requête est filtrée par l'utilisateur authentifié.
- **Premier compte (admin)** : créé en ligne de commande dans le conteneur.
- **Invitations** : l'admin génère depuis une page web des liens à usage unique qui expirent. L'invité choisit son identifiant et son mot de passe.
- **Inscription libre** : un interrupteur de configuration, désactivé par défaut.
- **Clé API** :
  - une seule clé active par utilisateur ;
  - stockée **hachée** et affichée une seule fois, à sa création ;
  - peut être régénérée ou révoquée depuis l'espace personnel ;
  - une clé révoquée est refusée immédiatement.
- **Pages web du MVP** : connexion, espace personnel (clé API, réglage MSU par univers), invitations (admin). Rien de plus.

### 5.9 Langue
- Le code, les commits et la documentation technique sont en anglais.
- Interface en **français et anglais** dès le départ. L'anglais est préféré pour le dossier de tolérance.

## 6. Architecture décidée

### 6.1 Stack (proposée, validée par l'utilisateur)
- **TypeScript partout**, dans un **monorepo** (pnpm workspaces) :
  - `packages/shared` : types des événements, schémas de validation (par exemple zod) et règles de calcul partagées ;
  - `apps/userscript` : le script, compilé avec Vite et un plugin userscript, publié en `.user.js` **non minifié** ;
  - `apps/server` : **Node + Fastify**, **PostgreSQL**, pages web rendues côté serveur.
- **Docker Compose** : deux services, `app` et `postgres`, plus un volume pour les données. Un `Dockerfile` multi-étapes.
- **Tests** : Vitest. Les parseurs sont testés sur des **fixtures HTML réelles** capturées sur le PTS.

### 6.2 Identité et dédoublonnage
- **Compte OGame** = (`serverId`, `lang`, `playerId`), tiré des meta `ogame-universe` et `ogame-player-id`.
  - Deux comptes ne sont **jamais** fusionnés sur la base du pseudonyme.
  - La communauté (`lang`) et le numéro de serveur restent distincts.
- **Rapport** = (compte, `data-msg-id`).
- **Départ de flotte** :
  - si le jeu renvoie un identifiant de flotte : (compte, identifiant de flotte) ;
  - sinon : une clé composite déterministe (compte, heure de départ à la seconde, origine, destination, mission, composition).
  - À vérifier sur le PTS (§9).
- **Anomalies** : une clé dérivée des identifiants exposés par la page. À définir avec les captures.
- **Deux observations du même événement qui divergent** : on garde les deux observations et on marque l'événement **en conflit**. Le premier état reste la référence affichée, sans écrasement silencieux.

### 6.3 Modèle de données (principes)
- On sépare les **observations** (ce qu'un appareil a vu : payload brut `data-raw-*` ou réponse AJAX, appareil, date de lecture) des **événements** (l'interprétation canonique et dédoublonnée).
- **On conserve le brut** pour pouvoir **ré-interpréter l'historique** si un parseur est corrigé plus tard, alors que les messages du jeu auront disparu.
- **Qui interprète** — *décision de conception* :
  - Le client extrait les attributs bruts, l'identité du message et son type. Il n'envoie que les messages de ses propres types suivis.
  - **Le serveur interprète** avec les parseurs de `packages/shared` et fait autorité.
  - « Non reconnu » est un verdict du serveur, renvoyé dans l'accusé de réception.
  - Les données brutes de combat contiennent des noms, identifiants et coordonnées d'autres joueurs. L'écran de consentement et le dossier de tolérance doivent le déclarer.
- Les champs inconnus sont nuls, au sens « inconnu », et distincts de 0.
- Chaque événement garde sa **provenance** : collecte, et plus tard import.
- Les stats de l'encart sont calculées à la demande à partir des événements, avec un cache éventuel. On ne maintient pas de compteurs incrémentaux qu'on ne pourrait plus réconcilier.
- Le **fuseau de chaque univers** est conservé, pour que le regroupement par jour se fasse à l'heure du serveur OGame, identique sur tous les appareils.

### 6.4 API client ↔ serveur
- Authentification par clé API, dans un en-tête.
- Endpoints minimaux :
  - envoi d'un lot d'observations, avec un accusé de réception par élément (accepté, déjà connu, rejeté avec motif) ;
  - lecture des stats de l'encart pour un compte, une période et une plage ;
  - lecture et écriture des réglages (MSU) ;
  - test de connexion.
- L'API est **versionnée**. Le serveur peut refuser un client trop ancien avec un message explicite.

### 6.5 Diffusion (validée par l'utilisateur)
- Le code est publié dans un **dépôt GitHub public** sous **licence MIT**, avec un `THIRD_PARTY_NOTICES` si du code d'OGLight est repris.
- Le `.user.js` est publié sur **Greasy Fork une fois toléré**, pas avant. Les mises à jour passent par `@updateURL` et `@downloadURL`, qui pointent vers Greasy Fork.
- Avant la tolérance, le script s'installe à la main depuis les artefacts de build, **uniquement sur le PTS**.
- Il n'y a **pas d'URL de serveur par défaut** : chaque utilisateur saisit la sienne. La règle `@connect` doit permettre une URL saisie par l'utilisateur (Tampermonkey lui demande alors une autorisation), et le dossier de tolérance doit le justifier.
- Chaque version a un **changelog** au format exigé par OGame (§10).

## 7. Laissé au constructeur
- Choix de l'ORM ou du query builder, du moteur de templates et du plugin Vite userscript.
- Schéma SQL exact, en respectant les principes du §6.3.
- Stratégie de lots et taille de file côté client. Les nouvelles tentatives restent limitées aux moments du §4.1 : pas de minuteur.
- Mise en page de l'encart et du détail, dans l'esprit d'OGLight, sans en copier les visuels.
- Méthode d'obtention du fuseau de l'univers : DOM ou API publique via le proxy communautaire `ogapi.faw-kes.de`, avec cache, conformément aux règles.
- Ordre de livraison des parties, dans le plan.

## 8. Critères d'acceptation du MVP
Ils reprennent la spec §12, restreints au périmètre du MVP :
- Un rapport lu sur PC puis sur mobile apparaît une seule fois.
- Deux rapports distincts aux gains identiques comptent chacun.
- Deux utilisateurs et deux univers restent isolés.
- Un coût prévisionnel non suivi d'un départ confirmé n'est pas compté.
- Après une coupure, les événements en attente sont envoyés sans doublon.
- L'encart indique quand il n'est pas à jour.
- Le masquage de l'encart OGLight est réversible et laisse ses autres fonctions intactes.
- Une clé révoquée n'accède plus à rien.
- Une information manquante n'est jamais affichée comme un zéro certain.
- Un vieux rapport lu aujourd'hui est compté à sa date d'origine.
- Aucune requête n'est émise vers le serveur du jeu par le script. On peut le vérifier dans l'onglet réseau.
- Rien n'est envoyé au serveur avant le consentement explicite.
- Aucune fonction du jeu n'est remplacée et aucun minuteur n'est utilisé par le script.
- La checklist de `AGENTS.md` §7 est entièrement cochée, et les zones grises sont signalées.

## 9. Points ouverts qui ont besoin d'une entrée externe
1. **Captures des anomalies** (HTML et HAR), à fournir par l'utilisateur. Sans elles, le module anomalies est bloqué.
   - Les captures doivent inclure **les messages reçus en fin de mission d'anomalie**.
   - Si une mission d'anomalie génère aussi un rapport de combat ou de transport classique, il faut une règle d'exclusion ou de rattachement pour ne pas compter les gains deux fois (butin et récompense).
2. **Fixtures de messages**, de préférence capturées sur le PTS : expédition (tous les résultats), combat (y compris en un round, de sondes seules et en position 16), recyclage, champ d'épaves, découverte FdV, **transports reçus d'un autre joueur et livrés à un autre joueur**, ainsi qu'un transport entre ses propres planètes pour vérifier l'exclusion.
3. **Vérifications à faire sur le PTS** :
   - un rappel rembourse-t-il du deutérium ?
   - la réponse d'envoi de flotte contient-elle un identifiant de flotte ?
   - la réponse `miniFleet` expose-t-elle la consommation ?
4. **Questions aux ToolDevs** (forum Development) :
   - peut-on masquer l'encart d'un autre outil toléré ?
   - les rapports de combat bruts contiennent des noms, identifiants et coordonnées d'**autres joueurs**. Peut-on les envoyer et les conserver sur notre serveur, ou faut-il les retirer côté client avant l'envoi ? La réponse peut modifier le principe « on conserve le brut » du §6.3.
5. ~~**Nom du projet**~~ : réglé, **Starledger** (2026-11-11).

## 10. Procédure de tolérance OGame

Source : les fils du forum Origin cités au §3.3. Les règles évoluent : il faut relire les fils « Forbidden features » et « Do I need to submit my tool? » avant chaque dépôt.

1. **Avant le dépôt**
   - Poser les questions de zone grise sur le forum **Development** (https://forum.origin.ogame.gameforge.com/forum/board/11-development/), dont le masquage de l'encart OGLight. Obtenir une réponse **écrite** d'un ToolDev.
   - Développer et tester **uniquement sur le PTS** (Singularity, en_808, accessible par le lobby « pioneers »). On peut copier son compte réel vers le PTS depuis Options → Extended.
   - Faire l'auto-audit de la §7 d'`AGENTS.md`.
2. **Figer une version** : numéro de version, `.user.js` non minifié, code source public sur GitHub, serveur déployé et joignable par les reviewers.
3. **Ouvrir un fil** dans **Submissions & API Requests** (https://forum.origin.ogame.gameforge.com/forum/board/12-submissions-api-requests/), avec le modèle « Tool Submission Template » (fil 332). Le dossier est en anglais et contient :
   - la liste **exhaustive** des fonctionnalités ;
   - les endpoints du jeu utilisés et leur fréquence. Pour nous : aucun appel émis, seulement la lecture du DOM et l'observation des réponses aux actions du joueur ;
   - toutes les modifications de l'interface, avec des captures d'écran (encart, détail, options, masquage OGLight) ;
   - la gestion des données : stockage local, envoi au serveur externe (quoi, où, consentement, données d'autres joueurs contenues dans les rapports de combat), aucune télémétrie ;
   - le lien vers le code source non minifié ;
   - la déclaration de conformité ;
   - **le serveur est revu aussi** : décrire ce qu'il stocke, l'isolation entre utilisateurs, la suppression des données sur demande.
4. **Pendant la revue**, ne pas publier de nouvelle version : toute mise à jour relance la revue. Ne rien publier sur Greasy Fork. Aucun délai n'est annoncé.
5. **Après la tolérance**
   - Publier sur Greasy Fork.
   - Pour chaque nouvelle version, poster un changelog qui détaille, fonctionnalité par fonctionnalité : les données collectées, leurs sources, les nouvelles requêtes, l'envoi externe, l'automatisation et les modifications d'interface. Un oubli peut coûter la tolérance.
   - Une nouvelle fonctionnalité sensible se valide d'abord avec un ToolDev.
