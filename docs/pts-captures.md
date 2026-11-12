# Captures et vérifications PTS à faire

Suivi de ce qui manque encore du PTS (Singularity, en_808) pour valider les parseurs (scope 10), le carburant (scope 11), les transports (scope 12) et les anomalies (scope 13). À cocher au fur et à mesure ; le détail des formats vérifiés est dans `docs/ogame-data-formats.md`.

## Comment capturer

1. Consentement avec une URL qui ne mène nulle part (`https://starledger.invalid`) et **aucune clé API** : sans clé, rien n'est envoyé et la file reste exportable.
2. Afficher les messages dans la messagerie du jeu (le script les collecte à l'affichage).
3. Menu Tampermonkey → « Exporter les observations en file (debug) », puis transmettre le JSON. Les doublons entre plusieurs exports ne posent pas de problème.

Les exports contiennent le pseudo et ceux des autres joueurs : ils sont anonymisés avant d'être commités comme fixtures.

## Déjà reçu (2026-11-12)

- [x] Recyclage (32) : cristal seul, lu correctement.
- [x] Découverte de formes de vie (61), résultat « rien » : le jeu n'envoie alors aucun champ de résultat (12 messages).
- [x] Découverte de formes de vie (61), artefacts de taille normale (4 messages) : 14, 6, 3 et 10 artefacts, confirmés contre l'affichage du jeu.
- [x] Retour de flotte (34) : non lu, volontairement ; le retour des recycleurs porte la cargaison, seul le rapport de recyclage compte.

## Messages manquants

### Expéditions (41)

- [ ] Ressources (métal, cristal ou deutérium)
- [ ] Antimatière
- [ ] Vaisseaux trouvés
- [ ] Rien
- [ ] Objet
- [ ] Marchand
- [ ] Retour en avance
- [ ] Retour en retard
- [ ] Trou noir
- [ ] **Pirates ou aliens + le rapport de combat en position 16 (25)** : priorité 1, les pertes sont aujourd'hui déduites deux fois

### Combats

- [ ] Combat normal en plusieurs rounds (25), en attaque ou en défense
- [ ] Combat terminé au premier round (48)
- [ ] Espionnage où seules les sondes se battent et sont détruites
- [ ] Défense sans réparation de défenses : le jeu omet-il la liste ou écrit-il `[]` ? Réponse partielle (PTS 2026-11-12) : `repairedTechnologies` vaut `[]` dans le rapport d'une attaque de sondes sans combat ; à confirmer sur une vraie défense
- [x] Attaque de sondes envoyée sur la lune vide d'un inactif, rapport à zéro round (25, `combatrounds` vide, vainqueur attaquant)
- [ ] Combat sans butin : même question. Réponse partielle (PTS 2026-11-12) : la liste `loot.resources` est présente avec des montants à 0 (et une entrée `food`), `debris.resources` vaut `[]`. Un combat sans butin et sans débris a donc bien des listes écrites `[]` ; reste à confirmer pour un combat avec butin réel
- [ ] Champ d'épaves récupéré, « vaisseaux récupérés » (54)

### Découvertes de formes de vie (61)

- [x] Expérience de forme de vie gagnée
- [~] Forme de vie trouvée : impossible à capturer sur ce compte (toutes les formes de vie déjà découvertes, le jeu renvoie alors `lifeform-xp` avec `lifeformalreadyowned`). Reste couvert par un test unitaire du parseur (valeur `lifeform-found` reprise de la doc d'OGame Tracker) ; non vérifié sur le PTS, accepté (2026-11-12).
- [x] Vaisseau perdu

### Recyclage (32)

- [ ] Champ avec du métal **et** du cristal
- [ ] Champ plus gros que la capacité des recycleurs (il en reste)
- [ ] Recyclage en position 16, issu d'une expédition

### Transports (scope 12)

- [ ] Ressources reçues d'un autre joueur
- [ ] Ressources livrées à un autre joueur
- [ ] Transport entre ses propres planètes (doit être exclu)

### Anomalies (scope 13)

- [ ] Messages reçus en fin de mission d'anomalie (HTML et HAR)
- [ ] Rapport de combat ou de transport classique éventuel produit par la même mission (pour éviter de compter deux fois butin et récompense)

## Vérifications sur le PTS

### Carburant (scope 11)

- [x] Envoi par la page Flotte, avec et sans OGLight : `ajaxSend`/`ajaxSuccess` déclenchés, `getConsumption()` exact au `sendFleet` (2026-11-12)
- [x] Sondes depuis la galaxie (`miniFleet`) : pas de consommation, pas d'identifiant de flotte (2026-11-12)
- [x] Rappel : aucun deutérium remboursé (2026-11-12)
- [ ] Avec le nouveau script : une expédition envoyée augmente le carburant de l'encart de la valeur affichée par le jeu
- [ ] Un envoi refusé par le jeu ne change rien

### Avec un serveur configuré

- [ ] Synchronisation : l'encart affiche les stats après configuration de l'URL et de la clé
- [ ] Un même rapport lu sur PC puis sur mobile ne compte qu'une fois
- [ ] Fenêtre de détail : rendu vérifié, capture pour le fil du forum
- [ ] Affichage mobile (encart, fenêtres, menu du jeu non recouvert hors fenêtre ouverte)
- [ ] Fonctionnement sous Firefox
- [ ] `ogame.messages.content` est rempli avant le `ajaxSuccess` global (décisions, scope 8)

## Hors PTS : réponses ToolDev

Fil : https://forum.origin.ogame.gameforge.com/forum/thread/598-gray-area-questions-before-submitting-a-stats-sync-userscript-expeditions-combat/

- [ ] Masquage de l'encart OGLight
- [ ] Données des autres joueurs dans les rapports de combat (envoi et conservation)
- [ ] Fond sombre des fenêtres réglages et détail
