# Skyjo Action — Feuille de score

Une feuille de score pour le jeu de cartes **Skyjo**, dans un seul fichier HTML.
Pas d'installation, pas de build, pas de compte : tu ouvres `index.html` et tu joues.

En bonus, une photo de la grille d'un joueur peut être lue automatiquement par
Claude pour remplir les cartes et calculer le score de la manche.

## Utilisation

Trois façons de lancer l'app :

| Méthode | Comment |
| --- | --- |
| Double-clic | Ouvre `index.html` dans le navigateur. C'est tout. |
| Serveur local | `python -m http.server 8000` puis <http://localhost:8000> |
| Hébergement statique | Copie `index.html` sur n'importe quel hébergeur (GitHub Pages, Netlify…) |

Une connexion internet est nécessaire au premier chargement : React, Babel et les
polices sont chargés depuis des CDN.

### Déroulé d'une partie

1. **Setup** — choisis les joueurs (2 à 8). Les noms habituels sont proposés en un
   tap, sinon tu saisis le nom que tu veux.
2. **Manche** — pour chaque joueur, entre son score de fin de manche :
   - 📷 **photo** de la grille (lecture automatique par Claude),
   - 🧮 **grille** 3×4 à remplir carte par carte, le total se calcule tout seul,
   - ✏️ **saisie directe** du total si tu as déjà compté.
3. **Validation** — l'app demande qui a terminé la manche (celui qui a retourné
   toutes ses cartes) et applique la règle du doublement si nécessaire.
4. **Fin** — dès qu'un joueur atteint **100 points**, la partie s'arrête. Le score
   le plus bas gagne. Tu peux enchaîner sur une revanche ou une nouvelle partie.

Le 🏆 affiche le classement à tout moment, le 🗓️ l'historique manche par manche.

### Fonction photo (optionnelle)

Pour lire une grille depuis une photo, il faut une clé API Anthropic, à coller
dans les réglages (icône 🔑). Elle est stockée **uniquement dans le navigateur**
(`localStorage`) et n'est envoyée qu'à l'API Anthropic. L'usage de l'API est
facturé par Anthropic selon ta consommation.

Sans clé, tout le reste de l'app fonctionne normalement.

> ⚠️ La clé est utilisée directement depuis le navigateur. C'est acceptable pour
> un usage personnel sur ton propre téléphone ; ne déploie pas cette page avec
> une clé partagée ou sur un poste public. Voir
> [docs/photo-scoring.md](docs/photo-scoring.md).

## Documentation

- [docs/](docs/README.md) — index de la documentation
- [Architecture](docs/architecture.md) — structure du fichier, composants, état
- [Modèle de données](docs/data-model.md) — grille, cartes, manches
- [Règles du jeu](docs/game-rules.md) — scoring tel qu'implémenté
- [Lecture photo](docs/photo-scoring.md) — appel Claude, prompt, parsing
- [Développement](docs/development.md) — conventions, tests manuels, déploiement

## Licence

Projet personnel. Skyjo est une marque de Magilano ; ce projet n'est ni affilié
ni approuvé par l'éditeur.
