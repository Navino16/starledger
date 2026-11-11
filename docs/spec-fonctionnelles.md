# Suivi OGame partagé — spécifications fonctionnelles

Statut : document de travail à valider. Aucun choix technique ni développement demandé.

## 1. Objectif
Retrouver un suivi commun de son activité OGame sur PC et téléphone, avec un résumé directement dans le jeu et un dashboard externe détaillé. S'inspirer des usages d'OGLight et d'OGame Tracker sans imposer leur synchronisation interne.

## 2. Périmètre demandé
### Dans OGame
- Lire les données quand le joueur les affiche.
- Calculer et suivre la consommation de deutérium liée aux vols.
- Afficher des statistiques simples, à la manière d'OGLight.
- Permettre la saisie d'une clé API personnelle pour rattacher les données à l'utilisateur du service.
- Proposer une option pour masquer l'encart de statistiques OGLight uniquement.

### Sur le service externe
- Gérer plusieurs utilisateurs avec des données privées séparées.
- Fournir une clé API personnelle à chaque utilisateur.
- Gérer plusieurs univers par utilisateur.
- Proposer un dashboard détaillé par univers, inspiré d'OGame Tracker.

## 3. Collecte dans OGame
- Recueillir les rapports affichés : expéditions, combats, recyclages et découvertes de formes de vie.
- Rattacher chaque observation au compte et à l'univers concernés.
- Conserver la date de l'événement, distincte du moment de sa lecture.
- Ne pas lancer d'action de jeu, ouvrir de rapport ou parcourir de page à la place du joueur.
- Expliquer que les rapports jamais affichés ne sont pas nécessairement suivis.
- Signaler un rapport non reconnu plutôt que produire des statistiques inventées.

## 4. Consommation de deutérium
- Suivre les dépenses de carburant des départs manuels confirmés.
- Distinguer un coût prévisionnel d'une dépense enregistrée.
- Ne pas enregistrer une dépense si l'envoi est annulé ou échoue.
- Ne compter chaque départ qu'une fois, même après relecture ou utilisation de plusieurs appareils.
- Permettre une consultation par période et, si l'information est disponible, par type de mission.
- Indiquer explicitement les consommations non connues ; une absence de suivi ne signifie pas une consommation nulle.
- Ne pas présenter l'historique Tracker importé comme un historique complet des dépenses de carburant.
- Règles des rappels, remboursements éventuels et portée des missions : à préciser avant validation.

## 5. Encart de statistiques dans le jeu
- Afficher les statistiques de l'univers et du compte en cours.
- Présenter un résumé partagé entre appareils, pas seulement l'activité de l'appareil courant.
- Indiquer la fraîcheur des statistiques et les données en attente de synchronisation.
- Proposer le masquage réversible de l'encart OGLight sans désactiver ses autres fonctions.
- Rester utilisable sur PC et mobile.
- Contenu proposé à valider : nombre d'expéditions, ressources gagnées, vaisseaux trouvés/perdus, antimatière trouvée, carburant enregistré et bilan de la période.
- Période par défaut et personnalisation de l'encart : à définir.

## 6. Association au service et continuité
- Permettre de saisir, remplacer et retirer la clé API dans le client.
- Confirmer si la connexion au service fonctionne ou expliquer l'erreur.
- Une clé invalide ne doit pas empêcher le jeu de fonctionner.
- Permettre de révoquer et renouveler sa clé depuis son espace personnel.
- Utiliser le même suivi sur plusieurs appareils sans partage des identifiants OGame.
- Lors d'une interruption de connexion, conserver les événements en attente et reprendre leur transmission sans doubles comptes.
- Distinguer les états à jour, en attente et en erreur.

## 7. Utilisateurs, comptes et univers
- Chaque utilisateur accède à ses propres données uniquement.
- Un utilisateur peut suivre plusieurs comptes OGame répartis sur plusieurs univers.
- Distinguer les communautés et les univers même si leurs noms ou numéros sont similaires.
- Ne jamais fusionner deux comptes uniquement parce qu'ils ont le même pseudonyme.
- Permettre de sélectionner l'univers et le compte consultés sur le dashboard.
- Modalités de création des utilisateurs et éventuel rôle administrateur : à définir.

## 8. Dashboard détaillé par univers
- Proposer un aperçu et un historique détaillé des événements.
- Filtrer par période et catégorie.
- Expéditions : nombre, résultats, répartition des occurrences, ressources, vaisseaux, antimatière et autres résultats disponibles.
- Combats : résultats, butin, vaisseaux perdus et débris issus des rapports disponibles.
- Recyclages : quantités effectivement récoltées, distinctes des débris créés.
- Découvertes FdV : nombre, résultats, expérience et artefacts lorsque ces informations sont connues.
- Carburant : dépenses enregistrées et couverture du suivi.
- Afficher séparément gains bruts, pertes et carburant ; expliquer le périmètre de tout bilan net.
- Distinguer les unités : ressources, antimatière, vaisseaux, expérience et artefacts ne sont pas additionnés arbitrairement.
- Identifier les données partielles ou incertaines.
- Présentation adaptée au PC et au téléphone.
- Comparaisons de périodes, graphiques et valorisation des vaisseaux : propositions à préciser, non actées.

## 9. Historique partagé et qualité des données
- Un même événement consulté plusieurs fois ou sur plusieurs appareils ne compte qu'une fois.
- La lecture d'anciens rapports ne doit pas déplacer leurs gains vers la journée de lecture.
- Les événements distincts, même identiques en résultat, restent distincts.
- Si deux observations d'un même événement divergent, préserver le conflit sans écrasement silencieux.
- Présenter une même convention de dates et de regroupement journalier sur tous les appareils ; fuseau à définir.
- Les statistiques sont limitées aux informations réellement collectées ou importées, sans garantie de couverture totale du compte.

## 10. Import, export et compatibilité des données
### 10.1 Import OGLight et OGame Tracker
- Accepter leurs exports pour initialiser le suivi ou mettre à jour un historique existant.
- Permettre de sélectionner les univers et comptes concernés.
- Prévisualiser les données reconnues, ajouts, doublons, incompatibilités et conflits avant confirmation.
- Réunir les exports de plusieurs appareils sans perdre leurs événements exclusifs.
- Réimporter un fichier ou relire un événement déjà importé sans augmenter les compteurs.
- Distinguer les événements détaillés des statistiques agrégées ; ne pas compter une même activité à la fois dans les deux sources.
- Pour OGLight, ne pas additionner aveuglément les agrégats quotidiens ; signaler les données impossibles à réconcilier précisément et demander un arbitrage si nécessaire.
- Conserver le sens, la date et la provenance des informations ; ne pas inventer les détails absents ou les dépenses de carburant manquantes.
- Ne pas remplacer les préférences de l'utilisateur lors d'un import d'historique.

### 10.2 Export compatible OGLight et OGame Tracker
- Proposer des fichiers compatibles avec les fonctions d'import des addons pour y mettre à jour les données de suivi disponibles.
- Permettre de sélectionner le format cible et les univers/comptes compatibles ; proposer une sélection de période lorsque le format permet une mise à jour sûre.
- Indiquer les catégories incluses, exclues et les conversions avec perte d'information avant téléchargement.
- Ne pas fabriquer de rapports individuels à partir de simples totaux OGLight pour satisfaire un format cible.
- Lorsque le format cible exige des données étrangères au suivi (empire, réglages, annotations), permettre d'utiliser un export récent de l'addon destinataire comme base afin de préserver ces informations.
- Avertir si l'import cible remplace une base plutôt que de compléter un historique ; ne pas présenter un export partiel comme une sauvegarde complète.
- Prévenir le remplacement d'informations plus récentes et recommander une sauvegarde préalable de l'addon destinataire.
- L'utilisateur effectue lui-même l'import dans l'addon cible ; aucune modification directe de sa base interne n'est prévue.
- Rendre explicites les versions de format reconnues et signaler les versions incompatibles.
- Ne pas garantir qu'un format tiers représente toutes les données de notre suivi.

### 10.3 Import/export propre à notre outil
- Fournir un export natif pour sauvegarder et restaurer les données personnelles de suivi, ou les transférer entre installations du service.
- Permettre de choisir tous les comptes/univers ou un sous-ensemble ; distinguer sauvegarde complète et export partiel.
- Préserver les événements détaillés, les consommations enregistrées, les agrégats hérités, leurs limites, dates et provenances nécessaires à une restauration fidèle.
- Inclure les préférences personnelles en option, séparément des historiques.
- Ne jamais inclure les clés API ni les autres secrets d'authentification ; rétablir l'association des appareils séparément.
- Proposer un import de complément/fusion par défaut ; une restauration remplaçant des données doit être distincte, explicite et précédée d'un avertissement et d'une confirmation.
- Afficher une prévisualisation et un compte rendu de l'import ; signaler les données incompatibles ou non restaurables.
- Un export réimporté sans nouvelle donnée ne doit pas modifier les statistiques.
- L'import ne doit pas donner accès aux données d'un autre utilisateur ni reprendre son identité ou ses droits.

### 10.4 Limites fonctionnelles
- Les échanges avec OGLight/Tracker servent à la reprise et à la mise à jour des historiques, sans imposer un aller-retour sans perte entre formats différents.
- Les catégories réellement transférables dépendent du contenu et de la version du format source et cible.
- Les conflits non résolubles automatiquement ne doivent pas entraîner de suppression ou de double comptage silencieux.

## 11. Hors périmètre
- Automatiser les actions dans OGame.
- Collecter les identifiants de connexion OGame.
- Modifier directement les bases internes des extensions existantes ; les mises à jour par fichiers d'import/export compatibles restent dans le périmètre.
- Reproduire l'ensemble des fonctionnalités d'OGLight ou d'OGame Tracker.
- Choisir une stack, un hébergement ou une architecture technique.
- Développer ou déployer l'application dans le cadre de ce document.

## 12. Critères d'acceptation fonctionnels
- Un rapport lu sur PC puis mobile apparaît une seule fois dans les statistiques partagées.
- Deux rapports distincts aux mêmes gains comptent chacun.
- Deux utilisateurs et deux univers restent isolés.
- Une dépense prévisionnelle non suivie d'un départ confirmé n'augmente pas la consommation enregistrée.
- Après une interruption de connexion, les événements en attente sont retrouvés sans doublons.
- L'encart indique quand son contenu n'est pas à jour.
- Le masquage de l'encart OGLight est réversible et laisse ses autres fonctionnalités disponibles.
- Une clé révoquée ne permet plus l'accès aux données concernées.
- Une importation répétée ne gonfle pas l'historique.
- Un événement déjà importé puis collecté dans le jeu ne compte pas une seconde fois.
- L'import d'agrégats OGLight et de rapports Tracker recouvrant la même activité ne double pas les gains ; toute ambiguïté est signalée.
- Un export destiné à un addon indique son périmètre, ses limites et les précautions de restauration.
- Un export natif complet réimporté dans un espace vide restitue les données de suivi exportées, sans clé API ni secret.
- Une restauration destructive exige une confirmation distincte d'un simple ajout de données.
- Une information manquante n'est jamais affichée comme une valeur nulle certaine.

## 13. Fonctions complémentaires retenues pour le cadrage
Leur intérêt est validé ; les détails et priorités restent à préciser. La rentabilité relève du bilan statistique de base inspiré des addons, pas d'une fonctionnalité supplémentaire distincte. Ne pas assimiler ce bilan à une comptabilité exhaustive si le carburant ou les pertes ne sont pas entièrement connus.

### Comparaison de périodes
- Comparer jours, semaines ou périodes personnalisées : volumes, gains moyens par événement, pertes et carburant connu.
- Afficher le nombre d'événements et les limites de couverture pour contextualiser les comparaisons.

### Journal consultable et recherche
- Rechercher par date, catégorie, coordonnées ou résultat lorsque disponibles.
- Accéder depuis un indicateur ou graphique aux événements qui le composent.

### Couverture et qualité du suivi
- Afficher le début du suivi, les interruptions connues, erreurs de lecture et dernière collecte par appareil.
- Ne pas présenter une absence d'événement comme une preuve d'absence d'activité.

### Annulation d'import
- Identifier chaque opération d'import et permettre d'annuler ses contributions propres.
- Préserver les événements aussi connus par une autre collecte ou un autre import.
- Prévisualiser l'impact et demander confirmation ; préserver ou signaler les modifications ultérieures affectées.

### Objectifs personnels
- Définir des objectifs sur une période : expéditions, ressources, antimatière, artefacts ou expérience FdV.
- Afficher leur progression selon les données connues, sans action automatique dans le jeu.

### Annotations de l'historique
- Ajouter, modifier et supprimer des notes datées : composition de flotte, changement de classe ou de bonus, etc.
- Les afficher avec les statistiques sans présenter les corrélations comme des causalités démontrées.

### Personnalisation de l'encart
- Choisir les indicateurs et la période affichés, avec un mode compact sur mobile.
- Permettre de masquer notre propre encart indépendamment de celui d'OGLight.

### Bilans périodiques
- Consulter une synthèse quotidienne et hebdomadaire dans le dashboard.
- Notifications facultatives, uniquement après activation explicite ; fréquence et canal à définir.

### Gestion des appareils
- Consulter les appareils associés et leur dernière synchronisation.
- Révoquer l'accès d'un appareil sans déconnecter les autres ; distinguer cette action du renouvellement de la clé personnelle.

### Partage volontaire
- Partager un bilan ou graphique en lecture seule, en choisissant le périmètre partagé.
- Masquer par défaut coordonnées et données sensibles ; prévisualiser ce qui sera visible et permettre de révoquer le partage.

### Suppression des données
- Supprimer un événement erroné, une période ou un compte suivi après prévisualisation et confirmation.
- Empêcher une réapparition silencieuse depuis une collecte ultérieure ou une ancienne sauvegarde ; toute restauration volontaire doit être explicite.
- Définir séparément suppression d'une donnée erronée et annulation de sa seule source d'import.

## 14. Pistes à explorer — hors engagements fonctionnels
Ces idées sont conservées pour exploration ultérieure. Elles ne sont ni des fonctionnalités actées, ni des exigences de première version. Leur utilité, leur faisabilité et les informations nécessaires restent à évaluer, sans choix technique.

### Comparaison des compositions d'expédition
- Associer les départs à leur composition afin de comparer gains, pertes, carburant et durée d'immobilisation.
- Limiter les analyses aux informations effectivement collectées ; ne pas supposer que les anciens rapports permettent de reconstruire les flottes envoyées.
- Présenter le nombre d'observations et les facteurs de contexte disponibles, sans déduire automatiquement une supériorité causale.

### Regroupement par vague d'expéditions
- Présenter le bilan d'une vague : résultats, pertes, consommation connue et retours retardés.
- Définir ce qui constitue une vague et signaler les associations incertaines entre départs et rapports.

### Statistiques par planète de départ
- Répartir l'activité d'expédition, de raid et de découverte par planète d'origine lorsque celle-ci est connue.
- Conserver une catégorie d'origine inconnue plutôt que deviner une affectation.

### Médiane et dispersion des résultats
- Compléter les moyennes par la médiane et la distribution des gains pour distinguer résultats habituels et trouvailles exceptionnelles.
- Afficher l'échantillon et la période concernés, ainsi que le périmètre de valorisation éventuel.

### Vues enregistrées
- Enregistrer des ensembles de filtres nommés et les retrouver sur les différents appareils.
- Exemples : expéditions de la semaine, pertes en combat, découvertes FdV du mois.

### Dashboard personnalisable
- Choisir les blocs visibles et leur ordre.
- Permettre éventuellement des dispositions distinctes sur PC et mobile, indépendamment de la personnalisation de l'encart dans le jeu.

### Vue d'ensemble multi-univers
- Présenter les comptes actifs et leur activité depuis une page commune, avec accès à chaque univers.
- Garder les résultats séparés par défaut et expliciter les différences de paramètres avant toute comparaison ou consolidation.

### Archivage des univers et comptes
- Conserver l'historique des univers terminés ou des comptes abandonnés, sans les mélanger aux comptes actifs.
- Permettre leur consultation et leur réactivation dans les vues si nécessaire, sans confondre archivage et suppression.

### Continuité après fusion ou migration d'univers
- Relier l'ancien compte au nouveau pour consulter son parcours tout en préservant l'univers d'origine de chaque événement.
- Prévenir les collisions d'identifiants et les doubles comptes ; les règles d'association restent à définir.

### Traçabilité des chiffres
- Expliquer l'origine d'un gain, d'une perte ou d'une dépense : collecte sur un appareil, import ou correction.
- Retrouver les sources qui contribuent à un chiffre et aider à comprendre les écarts avec les addons tiers.

## 15. Questions fonctionnelles ouvertes
- Quelles statistiques exactes et quelle période dans l'encart du jeu ?
- Quels filtres, graphiques et comparaisons sont indispensables au dashboard ?
- Quelles missions inclure dans le suivi du carburant et comment traiter les rappels ?
- Quel fuseau définit les journées statistiques ?
- Comment créer les utilisateurs : inscription libre ou invitation ?
- Quels détails et priorités pour la gestion des appareils, le partage et la suppression des données ?
- Quel périmètre et quelle priorité pour la reprise des historiques existants ?
