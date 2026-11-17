# Icônes du jeu dans le dashboard web — conception courte

Date : 2026-11-17. Complète [`2026-11-17-web-dashboard-design.md`](2026-11-17-web-dashboard-design.md).

## Intention
Le dashboard se lit mieux avec les icônes du jeu, comme la fenêtre détail du userscript et OGLight (demande de l'utilisateur).

## Objectifs
- Icône de ressource devant le libellé des chiffres clés : métal, cristal, deutérium, antimatière, artefacts.
- Vignette du vaisseau devant son nom dans « Vaisseaux trouvés et perdus ».

## Non-objectifs
- Pas d'icône pour les résultats d'expédition ni les catégories : le jeu n'en a pas d'équivalent, les pastilles restent.
- Aucun changement visible du userscript.

## Anti-objectifs
- Copier les images dans le dépôt ou les servir depuis notre serveur : ce sont des visuels de Gameforge, on ne les redistribue pas.
- Envoyer au CDN de Gameforge l'adresse de la page Starledger : `Referrer-Policy: same-origin` reste en place.

## Approches considérées
1. **Charger les images depuis le CDN de Gameforge — retenu par l'utilisateur.** Mêmes adresses que le userscript et OGLight ; rien de redistribué. Coût : une exception à la règle « aucune ressource externe » de la spec web, limitée aux images de `*.geo.gfsrv.net`, et la CSP `img-src` qui s'ouvre à ce domaine.
2. Copier les icônes dans le dépôt et les servir nous-mêmes : site autonome, mais redistribution de visuels protégés dans un dépôt public. Écarté.

## Décisions prises
- Les adresses des images (sprite des ressources, artefacts, une image par vaisseau 202 à 219) passent du userscript (`apps/userscript/src/ui/icons.ts`) à `packages/shared`, utilisées par les deux (décision du rédacteur).
- CSP : `img-src 'self' data: https://gf1.geo.gfsrv.net https://gf2.geo.gfsrv.net https://gf3.geo.gfsrv.net`. Rien d'autre ne s'ouvre.
- Icône décorative (`aria-hidden`), le libellé texte reste ; une image qui ne charge pas laisse le libellé seul, sans casser la mise en page.
- Requêtes vers un CDN d'images statiques, jamais vers un serveur de jeu : aucune activité de jeu (AGENTS.md §4). Commentaire de conformité dans le code.
- L'usage des visuels du jeu hors du jeu s'ajoute aux questions pour les ToolDevs (scope 14), sans bloquer.

## Laissé au constructeur
- Taille exacte des vignettes et rendu dans l'axe du graphique Recharts (élément SVG `image` ou étiquette HTML).
