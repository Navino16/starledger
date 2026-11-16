# Front web du serveur et clés API multiples — conception

## Intention
Le serveur a aujourd'hui quelques pages rendues par des templates Eta, sans style : connexion, inscription par invitation, compte (clé API et réglages MSU par univers), invitations admin, erreur. Les prochains chantiers sont les dashboards de stats par univers (spec §8, §13) : graphiques, filtres de période et de catégorie, journal avec recherche. Des templates serveur ne tiendront pas cette interactivité.

On pose donc maintenant **une vraie app front**, dans le style de la fenêtre détail du userscript, et on y migre les pages existantes. Les dashboards viendront s'y brancher.

En même temps, on permet d'**ajouter un appareil plus tard sans reconfigurer les autres**. Aujourd'hui, un utilisateur n'a qu'une clé active (index `api_keys_one_active_per_user`) : en régénérer une révoque l'ancienne et coupe tous les appareils.

## Objectifs
- Une app `apps/web` (Vite + React + Tailwind CSS v4) servie par le serveur Fastify, qui remplace toutes les pages Eta.
- Une API JSON pour le site, authentifiée par la session (cookie) existante.
- Les écrans actuels, mis en forme : connexion, inscription (`/signup` et `/invite/:token`), compte, réglages, administration, erreur / page introuvable.
- Un en-tête commun aux pages connectées : nom, menu (plus tard Dashboard ; Compte ; Réglages ; Administration pour l'admin), utilisateur, déconnexion.
- Un bouton « Copier » sur la clé API tout juste créée, sur le lien d'invitation et sur le lien de réinitialisation.
- Plusieurs clés API actives par utilisateur, chacune nommée et révocable seule.
- Les réglages de valorisation sur leur propre page, une carte repliable par univers.
- Changer son mot de passe, et le réinitialiser quand on l'a oublié (lien créé par l'admin, ou commande serveur).
- Utilisable sur téléphone. Interface en français et en anglais, comme aujourd'hui.

## Non-objectifs
- Les dashboards de stats eux-mêmes : chantier suivant, sur cette base.
- Toute autre fonctionnalité : pas de liste des invitations ni des comptes, pas de sélecteur de langue, pas de thème clair, pas d'e-mail.
- Pas de rattachement des appareils (`devices`) à une clé, ni de page appareils : c'est la « gestion des appareils » de la spec §13, pour plus tard.
- Aucun changement de l'API du userscript (`/api/v1`) ni du userscript : il garde une clé par appareil.

## Anti-objectifs
- Affaiblir la sécurité actuelle : sessions, CSRF, limitation des tentatives (login, inscription), redaction des tokens d'invitation dans les logs, isolation entre utilisateurs.
- Stocker une clé API de façon réversible : on ne garde que son empreinte, une clé n'est affichée qu'une fois.
- Révoquer ou couper un appareil quand on crée une nouvelle clé.
- Charger une ressource externe (CDN, police web, analytics) : tout est servi par le serveur.
- Un code front illisible pour la revue de tolérance (`AGENTS.md` §0, §5) : le source est dans le dépôt public, et le bundle est produit **sans minification**. La règle vise notre code ; les dépendances npm restent telles que publiées, vérifiables par leur nom et leur version dans le lockfile (décision du rédacteur).

## Approches considérées
**Technologie du front :**
1. **Vite + React + Tailwind v4 dans `apps/web`, API JSON servie par Fastify — retenu par l'utilisateur.** Vraies bibliothèques de graphiques, composants réutilisables, contrats partagés avec `packages/shared` (zod), reprise directe des écrans de Claude Design (React). Coût : réécrire les pages actuelles, i18n côté front, un build de plus.
2. Svelte ou Vue au lieu de React — plus léger, mais écosystème de graphiques plus maigre et reprise de Claude Design moins directe.
3. Garder Eta + htmx et du JS pour les graphiques — rien à réécrire, mais tiendra mal quand les dashboards grossiront.
- Écartés : méta-frameworks (Next, SvelteKit), qui remplaceraient Fastify ou ajouteraient un second serveur pour un rendu serveur inutile derrière un login. Avant ce choix, l'option CSS seul (main ou Pico.css) sur les templates avait été écartée pour la même raison.

**Clés API :**
1. **Plusieurs clés nommées, affichées une seule fois — retenu par l'utilisateur.** Empreinte seule en base, révocation par appareil.
2. Une seule clé réaffichable — exige un stockage réversible, et la révocation reste tout ou rien.

## Décisions prises

### Architecture
- `apps/web` est un nouveau paquet du monorepo. Il dépend de `@app/shared` pour les schémas et types partagés.
- Le serveur sert le build de `apps/web` (fichiers statiques) et renvoie `index.html` pour toute route du site qui n'est ni l'API ni un fichier : le routage est côté client. Le Dockerfile construit les deux.
- **Un seul domaine**, pas de CORS. La session reste le cookie `@fastify/secure-session` actuel (httpOnly, SameSite lax).
- L'API JSON du site est **séparée** de `/api/v1` : `/api/v1` reste authentifiée par clé API pour le userscript, l'API du site par session. Elle reprend la logique existante (`users`, `invitations`, `api-keys`, `settings`) sans la dupliquer.
- Les écritures de l'API du site sont protégées contre le CSRF, comme les formulaires aujourd'hui.
- Les limitations de tentatives existantes (login, inscription) s'appliquent aux nouveaux endpoints.
- Les pages Eta, `@fastify/view`, `eta` et les routes HTML actuelles sont **supprimées** à la fin de la migration. Les URL visibles existantes restent : `/login`, `/signup`, `/invite/:token`, `/account`. S'ajoutent `/settings`, `/admin` (`/admin/invitations` y redirige) et `/reset/:token`.

### Style (validé sur maquette, style A)
- Celui de la fenêtre détail du userscript. Fond `#0d1014`, cartes `#161b23` à coins arrondis, fond secondaire `#1b212b`, lignes `#2a3240`, texte `#e7e8eb` / `#c9cdd6`, secondaire `#858b98`, désactivé `#5b6270`, accent doré `#e3b955` (bouton principal, onglet actif), erreur `#e2574c`, succès `#64a69b`. Couleurs des ressources : métal `#9899be`, cristal `#95c1dd`, deutérium `#64a69b`, antimatière `#b88ce8`. Police système.
- Ces couleurs sont les tokens du thème Tailwind (`@theme`), réutilisés par les dashboards.
- Pages hors connexion : une carte centrée avec le nom en tête, sans menu. Pages connectées : en-tête commun.
- Les écrans sont dessinés : maquettes, tokens, composants et règles dans [`docs/web-design.md`](../../web-design.md). Ils précisent la mise en page, pas le périmètre.
- Page compte : une carte « Clés API » et une carte « Mot de passe ».
- Page réglages : une carte repliable (`<details>`) par univers, avec MSU sur 3 colonnes, ratios de vaisseaux sur 2 et cases à cocher en dessous (une colonne au téléphone). Une carte fermée résume les valeurs enregistrées. Sont ouverts l'univers en erreur, celui qu'on vient d'enregistrer, ou l'unique univers.
- Page administration : une carte « Invitations » et une carte « Réinitialiser un mot de passe ».
- Conteneur de 1200 px pour toutes les pages, formulaires sur 720 px alignés à gauche, pour que l'en-tête ne bouge pas quand les dashboards arriveront en pleine largeur.

### Clés API
- **Pas de limite** au nombre de clés actives (décision de l'utilisateur). Une migration supprime l'index `api_keys_one_active_per_user`.
- Chaque clé a un **nom**, obligatoire à la création (ex. « PC », « Téléphone »). Colonne nullable : la clé existante s'affiche « Sans nom ».
- Chaque clé a une **dernière utilisation**, mise à jour par l'authentification `/api/v1` au plus une fois toutes les 5 minutes.
- Carte « Clés API » : un champ nom avec « Créer une clé », puis la liste des clés actives (nom, préfixe, création, dernière utilisation ou « jamais ») avec « Révoquer » sur chaque ligne. La clé tout juste créée s'affiche une fois en haut de la carte, avec « Copier ». État vide : « Aucune clé API active. »
- « Régénérer » disparaît : on crée une nouvelle clé puis on révoque l'ancienne. Les clés révoquées restent en base mais ne sont plus listées.
- Révoquer une clé qui n'appartient pas à l'utilisateur connecté répond 404.

### Mots de passe
- **Changer** (page compte) : mot de passe actuel et nouveau, 12 caractères minimum comme à l'inscription. Les clés API ne changent pas.
- **Réinitialiser par lien** (page administration) : l'admin saisit l'identifiant Starledger du compte (« Aucun compte avec cet identifiant » s'il n'existe pas) et obtient un lien `/reset/:token`. Le lien est à usage unique, valable 24 heures, affiché une seule fois. Comme pour les invitations, on ne stocke que l'empreinte du token, et on la rattache au compte. L'ancien mot de passe reste valable tant que le lien n'a pas servi.
- **Réinitialiser en ligne de commande** : `reset-password --username <nom>`, sur le modèle de `create-admin` (mot de passe lu sur l'entrée standard). C'est le secours de l'admin.
- Les limitations de tentatives s'appliquent au changement et à la réinitialisation.

### Langue
- On garde la langue de l'utilisateur (`users.locale`) pour les pages connectées, et la négociation `Accept-Language` actuelle hors connexion.
- Les catalogues `fr.json` / `en.json` passent côté front, avec les clés ajoutées pour le menu, les sous-titres, « Copier » et la liste des clés.

## Laissé au constructeur
- Routeur, gestion des requêtes et des formulaires côté React, bibliothèque i18n (ou un petit traducteur comme `i18n.ts`).
- Préfixe et forme exacte des endpoints de l'API du site, et mécanisme CSRF pour des requêtes JSON (jeton en en-tête ou équivalent).
- Façon dont le serveur sert les fichiers statiques et le fallback `index.html`, en-têtes de cache.
- Façon dont le front connaît l'utilisateur courant (endpoint « moi » au chargement, par exemple) et redirige vers `/login`.
- Longueur maximale du nom d'une clé.
- Déconnecter ou non les autres sessions après un changement de mot de passe. La session est un cookie chiffré sans état côté serveur : il faudrait, par exemple, une version de session dans `users`.
- Ordre de migration des pages, du moment que chaque étape garde le site utilisable.
- Configuration de dev (proxy Vite vers Fastify).
- Tests : les tests actuels des routes web (`web-auth`, `invitations`, `settings`, `api-keys`) sont portés vers l'API du site ; le front a ses propres tests de composants.
- Versions des dépendances : règle du projet (`npx npm-check-updates`).
