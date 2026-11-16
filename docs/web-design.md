# Design du front web

Référence visuelle de `apps/web` : ce qu'il faut reproduire, avec quelles valeurs, et pourquoi. La spec fonctionnelle du front est [`superpowers/specs/2026-11-16-web-front-design.md`](superpowers/specs/2026-11-16-web-front-design.md) ; ce document ne décrit que l'apparence et le comportement des écrans.

## Les maquettes

Tout est dans [`web-design/`](web-design/), exporté de la maquette Claude Design du 16 novembre 2026 :

- [`web-design/starledger.css`](web-design/starledger.css) : la feuille de styles unique des maquettes. Les variables `:root` sont les tokens (voir plus bas).
- [`web-design/mockups/`](web-design/mockups/) : une page HTML statique par écran, en bureau et en téléphone. Elles s'ouvrent directement dans un navigateur, sans serveur ni ressource externe.
- [`web-design/screenshots/`](web-design/screenshots/) : la capture de chaque maquette (bureau à 1280 px, téléphone à 390 px).

Les maquettes « téléphone » ont le même HTML que les versions bureau : c'est la media query sous 640 px qui change la mise en page. Ouvertes dans une fenêtre large, elles s'affichent donc en version bureau dans une colonne de 390 px. Pour les voir comme sur un téléphone, utiliser la vue responsive des outils de développement à 390 px de large, ou regarder la capture.

| Écran | Bureau | Téléphone | État montré |
|---|---|---|---|
| Dashboard | [maquette](web-design/mockups/dashboard.html) · [capture](web-design/screenshots/dashboard.png) | [maquette](web-design/mockups/dashboard-phone.html) · [capture](web-design/screenshots/dashboard-phone.png) | Contenu **indicatif**, rien n'est défini |
| Compte | [maquette](web-design/mockups/account.html) · [capture](web-design/screenshots/account.png) | [maquette](web-design/mockups/account-phone.html) · [capture](web-design/screenshots/account-phone.png) | Clé juste créée, 3 clés, erreur de mot de passe (bureau) |
| Réglages | [maquette](web-design/mockups/settings.html) · [capture](web-design/screenshots/settings.png) | [maquette](web-design/mockups/settings-phone.html) · [capture](web-design/screenshots/settings-phone.png) | 4 univers, dont un en erreur (bureau) |
| Administration | [maquette](web-design/mockups/admin.html) · [capture](web-design/screenshots/admin.png) | [maquette](web-design/mockups/admin-phone.html) · [capture](web-design/screenshots/admin-phone.png) | Lien de réinitialisation créé (bureau), invitation créée et identifiant inconnu (téléphone) |
| Connexion | [maquette](web-design/mockups/login.html) · [capture](web-design/screenshots/login.png) | [maquette](web-design/mockups/login-phone.html) · [capture](web-design/screenshots/login-phone.png) | Identifiants invalides (bureau) |
| Créer un compte | [maquette](web-design/mockups/signup.html) · [capture](web-design/screenshots/signup.png) | [maquette](web-design/mockups/signup-phone.html) · [capture](web-design/screenshots/signup-phone.png) | Identifiant déjà pris (bureau) |
| Nouveau mot de passe | [maquette](web-design/mockups/reset-password.html) · [capture](web-design/screenshots/reset-password.png) | [maquette](web-design/mockups/reset-password-phone.html) · [capture](web-design/screenshots/reset-password-phone.png) | Mot de passe trop court (bureau) |

Pas encore dessinés : la page Erreur (carte centrée comme Connexion : titre, message, lien « Connexion »), l'état vide des clés API (« Aucune clé API active. », style `.sl-empty`) et l'état sans univers des réglages.

Dans les maquettes, les boutons d'envoi sont des `type="button"` et la déconnexion est un lien, pour permettre la navigation dans le prototype. Dans l'app, chaque action est un vrai formulaire ou une requête protégée contre le CSRF, déconnexion comprise.

## Principes

- **Le style de la fenêtre détail du userscript** : sombre, plat, en cartes. Ce qui donne de la couleur, ce sont les données (ressources, graphiques), pas l'interface.
- **Interdits** : dégradés, lueurs, ombres colorées, emoji, libellés en majuscules espacées, italique pour l'emphase.
- **Police système**, aucune police web ni CDN : tout est servi par le serveur (spec, anti-objectifs).
- **Un seul accent**, le doré : bouton principal, onglet actif, période sélectionnée, cases cochées. Une carte a au plus un bouton doré.
- **Utilisable au téléphone** : une seule colonne sous 640 px, cibles tactiles d'au moins 44 px.
- **Contraste WCAG AA** : texte ≥ 4,5:1 sur son fond, bordures de champs, icônes et barres de graphique ≥ 3:1.

## Tokens

Les noms suivent la convention de Tailwind v4, pour se coller tels quels dans un bloc `@theme` (voir [Implémentation](#implémentation-react--tailwind-v4)).

### Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--color-page` | `#0d1014` | Fond de page, fond des champs et des blocs de clé |
| `--color-card` | `#161b23` | Cartes |
| `--color-raised` | `#1b212b` | Boutons secondaires, survol des lignes et des en-têtes repliables |
| `--color-hover` | `#252d3a` | Survol des boutons secondaires, période sélectionnée |
| `--color-line` | `#2a3240` | Filets : en-tête, séparateurs de tableau, bordure des boutons secondaires |
| `--color-control` | `#687082` | Bordure des champs (3,5:1 sur la carte) |
| `--color-ink` | `#e7e8eb` | Titres, valeurs, texte des boutons |
| `--color-body` | `#c9cdd6` | Texte courant, libellés |
| `--color-muted` | `#858b98` | Texte secondaire : sous-titres, indications, en-têtes de colonnes (5,1:1 sur la carte) |
| `--color-disabled` | `#5b6270` | Éléments désactivés uniquement (ne passe pas 4,5:1) |
| `--color-gold` | `#e3b955` | Accent |
| `--color-on-gold` | `#0d1014` | Texte sur l'accent (le blanc ne fait que 1,9:1) |
| `--color-danger` | `#e2574c` | Bordure d'alerte, champ invalide, icône d'erreur, « Révoquer », barre de perte |
| `--color-success` | `#64a69b` | Bordure et icône du bandeau de succès |
| `--color-gain` | `#4f8f7a` | Barre de gain des graphiques (repris du userscript) |
| `--color-focus` | `#b4c8f7` | Anneau de focus clavier, 2 px plein, décalé de 2 px |
| `--color-metal` | `#9899be` | Métal |
| `--color-crystal` | `#95c1dd` | Cristal |
| `--color-deuterium` | `#64a69b` | Deutérium |
| `--color-dark-matter` | `#b88ce8` | Antimatière |

Les résultats d'expédition reprennent les couleurs du donut du userscript (`apps/userscript/src/ui/details/donut.ts`). Elles ne servent que de pastilles et de séries, jamais de texte.

`--color-control`, `--color-on-gold`, `--color-focus` et `--color-gain` s'ajoutent à la palette du brief : les trois premiers pour le contraste, le dernier vient du userscript. Les pertes utilisent `--color-danger` et non le `#8a3b37` du userscript, qui ne fait que 2:1 sur une carte.

### Typographie

- `--font-sans` : `system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
- `--font-mono` : `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`, pour les clés, les préfixes et les axes des graphiques

| Rôle | Taille / interligne | Graisse | Couleur |
|---|---|---|---|
| Titre de page | 28/36 (24/32 au téléphone) | 500 | ink |
| Chiffre clé d'une carte | 28/36, chiffres tabulaires | 500 | ink |
| Titre de carte, nom d'univers | 18/24 | 500 | ink |
| Nom « Starledger » | 16/24 | 600 | ink |
| Texte courant, champs, boutons | 14/20 | 400 (500 pour les boutons) | body |
| Libellé de champ, sous-titre de carte, alerte | 13/20 | 400 | body ou muted |
| Indication, légende de groupe, en-tête de colonne | 12/16 | 400 | muted |
| Axe de graphique | 11/16 mono | 400 | muted |

Seulement les graisses 400, 500, et 600 pour le nom. La hiérarchie vient de la taille et de la couleur. Les nombres sont en `font-variant-numeric: tabular-nums`.

### Rayons, espacements, mouvement

- Rayons : `--radius-card` 10 px (cartes), `--radius-control` 6 px (boutons, champs), `--radius-chip` 2 px (pastilles). Bandeaux et alertes : 8 px.
- Espacements sur une grille de 4 px : 24 px de padding de carte (16 au téléphone), 20 px entre les blocs d'une carte, 24 px entre les cartes, 8 px entre un libellé et son champ.
- Mouvement : une courbe `--ease` `cubic-bezier(0.22, 1, 0.36, 1)`, 150 ms, uniquement sur la couleur, le fond, la bordure et la rotation du chevron. Pression de bouton : `scale(0.98)`.

## Mise en page

- **Conteneur** : 1200 px max, padding 24 px (16 au téléphone), commun à l'en-tête et au contenu.
- **Colonne de formulaires** : sur les pages Compte, Réglages et Administration, les blocs font 720 px max, alignés à gauche sous le nom. Le dashboard (`.sl-main.is-wide`) prend toute la largeur.
- **En-tête des pages connectées** (56 px, filet en bas) : « Starledger », puis le menu (Dashboard, Compte, Réglages, Administration pour l'admin), puis à droite le nom de l'utilisateur et « Déconnexion » en bouton discret. L'onglet actif a `aria-current="page"`, un texte ink et un trait doré de 2 px en bas. Au téléphone, le menu passe sur une deuxième ligne et défile horizontalement s'il déborde.
- **Pages hors connexion** (Connexion, Créer un compte, Nouveau mot de passe, Erreur) : une carte de 400 px centrée verticalement (en haut au téléphone), avec « Starledger », puis le titre. Pas de menu.
- **Point de rupture unique** : 640 px. En dessous, les grilles passent à une colonne, les boutons principaux prennent toute la largeur, et les boutons et champs passent à 44 px de haut.

## Composants

Les classes `.sl-*` n'existent que dans les maquettes : dans l'app, ce sont des composants React.

- **Bouton** (`.sl-btn`, 40 px) :
  - *principal* : fond doré, texte `on-gold` ;
  - *secondaire* : fond `raised`, filet `line` ;
  - *discret* (`-ghost`) : sans fond ni bordure, pour « Déconnexion » ;
  - *danger* : texte rouge sans bordure, bordure au survol, pour « Révoquer ».

  Il existe aussi une petite taille de 32 px (`-sm`) et une version pleine largeur (`-block`).
- **Champ** (`.sl-field`) :
  - libellé au-dessus, champ sur fond `page` avec bordure `control` ;
  - indication en dessous (`.sl-hint`), reliée par `aria-describedby` ;
  - champ invalide : `aria-invalid="true"`, bordure rouge, et message sous le champ (`.sl-field-error`, icône rouge, texte `body`) qui remplace l'indication.
- **Case à cocher** : native, 18 px, `accent-color` doré, libellé cliquable à droite.
- **Carte** (`.sl-card`) : en-tête titre et sous-titre, puis le contenu. Une carte = un sujet = un formulaire au plus.
- **Bandeau de succès** (`.sl-notice`) : bordure `success`, icône de validation, message. Il contient le secret à copier (`.sl-secret`) : texte mono sur fond `page`, sélectionnable en un clic (`user-select: all`), et bouton « Copier » (API Clipboard) qui devient « Copié ». Si le presse-papiers est refusé, la sélection en un clic reste possible.
- **Alerte** (`.sl-alert`, `role="alert"`) : bordure rouge, icône rouge, texte `body`. Elle sert aux erreurs qui ne visent pas un champ (identifiants invalides, réglages invalides, mot de passe actuel incorrect) et se place en haut de la carte ou du formulaire.
- **Liste des clés** (`.sl-keys`) : un vrai `<table>` (Nom, Clé, Créée le, Dernière utilisation, action). Au téléphone, chaque ligne devient une fiche :
  - le nom à gauche, le préfixe à droite ;
  - la création et la dernière utilisation en dessous, précédées de leur libellé (`data-label`) ;
  - « Révoquer » à droite.

  « Sans nom » et « jamais » sont en `muted`.
- **Carte d'univers repliable** (`.sl-universe`) : un `<details>` natif, qui s'ouvre sans JavaScript. Le `<summary>` (64 px de haut, entièrement cliquable) contient :
  - le nom de l'univers ;
  - une ligne de résumé avec les valeurs enregistrées, masquée quand la carte est ouverte ;
  - un chevron qui pivote à l'ouverture.

  Le serveur pose `open` sur l'univers en erreur, celui qu'on vient d'enregistrer, ou l'unique univers.
- **Ratios MSU** : légende « Ratios MSU », puis Métal, Cristal, Deutérium sur 3 colonnes, chacun précédé de sa pastille de couleur de 8 px. C'est le seul endroit hors dashboard où apparaissent les couleurs des ressources.
- **Sélecteur de période** (`.sl-segment`) : des liens Jour, Semaine, Mois, Tout. La période active a un fond `hover` et une bordure dorée, comme dans la fenêtre détail du userscript.
- **Graphiques** (dashboard, indicatifs) :
  - barres de gain au-dessus et de perte en dessous d'une ligne de zéro `control` ;
  - axes en mono `muted`, grille en pointillés `line` ;
  - un `aria-label` qui résume les données sur la zone du graphique ;
  - une répartition se montre en liste avec des barres neutres (`muted` sur `raised`) et une pastille par catégorie, pas en camembert.

Icônes : des SVG en ligne, trait de 1,5, 16 ou 18 px, `currentColor`, `aria-hidden="true"`. On n'en utilise que trois : validation, alerte, copie, plus le chevron.

## Écrans

- **Dashboard** : à définir. Seuls sont fixés l'emplacement (premier onglet, page d'arrivée après connexion), la pleine largeur, la barre du haut (titre de période, univers, période) et un graphique principal à deux tiers à côté d'un bloc secondaire à un tiers.
- **Compte** :
  - **carte Clés API** : le bandeau de la clé juste créée en tête, le formulaire Nom et « Créer une clé », puis la liste ;
  - **carte Mot de passe** : le mot de passe actuel et le nouveau (12 caractères minimum), et « Changer le mot de passe ». Un champ identifiant caché sert aux gestionnaires de mots de passe.
- **Réglages** : le titre « Réglages de valorisation » et une phrase d'introduction, puis une carte repliable par univers. Chaque carte contient les ratios MSU, la légende « Vaisseaux » avec les deux pourcentages sur 2 colonnes, les trois cases à cocher et « Enregistrer ».
- **Administration** (admin seulement) :
  - **carte Invitations** : « Créer une invitation », puis le lien à copier, valable 72 heures ;
  - **carte Réinitialiser un mot de passe** : le champ « Identifiant Starledger » et « Créer un lien », puis le lien à copier, valable 24 heures. Si l'identifiant n'existe pas : « Aucun compte avec cet identifiant ».
- **Connexion**, **Créer un compte** (depuis `/invite/:token`) et **Nouveau mot de passe** (depuis `/reset/:token`, avec « Compte : <identifiant> ») : la carte centrée décrite plus haut. Créer un compte se termine par « Déjà un compte ? Se connecter ». Un lien expiré ou déjà utilisé mène à la page Erreur.

## Rédaction

- Les textes viennent des catalogues `fr.json` / `en.json`. Les maquettes sont en français.
- Majuscule en début de phrase seulement. Pas de point final aux libellés, boutons, titres et sous-titres d'une phrase. Les messages de plusieurs propositions ou phrases gardent le leur.
- Un libellé ne répète pas son groupe : sous la légende « Ratios MSU », les champs s'appellent « Métal », « Cristal », « Deutérium ».
- Format français des nombres : virgule décimale, espace avant `%` (« 43,4 % »), signe moins typographique (« −2 M »), unités k, M, G comme dans le userscript.
- Dates courtes : « 16 nov. 2026, 14:32 ».

## Accessibilité

- Un `<label>` pour chaque champ, `<fieldset>` et `<legend>` pour les groupes, de vrais `<button>` et `<a href>`.
- Erreurs : `aria-invalid` sur le champ, message relié par `aria-describedby`, `role="alert"` pour les alertes, `role="status"` pour les bandeaux de succès.
- Le focus clavier est toujours visible (`:focus-visible`, anneau `focus`).
- Les graphiques ont un résumé textuel (`role="img"` et `aria-label`) ; chaque barre a un `title`.

## Implémentation React + Tailwind v4

L'app est une SPA React (spec). Les maquettes s'en tiennent à des comportements natifs (formulaires, `<details>`) : l'app les garde tels quels plutôt que de les recoder en composants à état.

Les variables de `starledger.css` se reprennent telles quelles dans la feuille d'entrée de `apps/web` :

```css
@import "tailwindcss";

@theme {
  --color-page: #0d1014;
  --color-card: #161b23;
  /* … toutes les variables de :root … */
  --radius-card: 10px;
  --font-sans: system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
}
```

Elles donnent directement des classes utilitaires : `bg-page`, `bg-card`, `text-muted`, `border-control`, `rounded-card`, `font-mono`… Les composants à créer sont ceux de la liste plus haut. Les écrans les assemblent, sans styles propres.

Quelques points ne s'expriment pas en utilitaires et demandent un peu de CSS ou de logique :
- la liste des clés en fiches au téléphone (grille sur `<tr>` et libellés `data-label`) ;
- le résumé masqué des cartes `<details>` ouvertes ;
- le marqueur natif du `<summary>` à supprimer.

## Points ouverts

- Le contenu des dashboards, la place du sélecteur d'univers et la bibliothèque de graphiques.
- Les couleurs des résultats d'expédition à intégrer en tokens au moment des dashboards.
