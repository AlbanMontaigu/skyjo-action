# Documentation — Skyjo Action

Documentation technique du projet. Pour l'usage courant, voir le
[README principal](../README.md).

## Sommaire

| Document | Contenu |
| --- | --- |
| [architecture.md](architecture.md) | Structure du fichier unique, arbre de composants, état, cycle de vie |
| [data-model.md](data-model.md) | Représentation d'une carte, d'une grille, d'une manche, d'un joueur |
| [game-rules.md](game-rules.md) | Les règles de Skyjo telles qu'implémentées, et celles qui ne le sont pas |
| [photo-scoring.md](photo-scoring.md) | Lecture d'une grille par photo : appel API, prompt, parsing, sécurité |
| [ui-design.md](ui-design.md) | Palettes, code couleur des cartes et des joueurs, patterns d'interface |
| [development.md](development.md) | Lancer, modifier, tester manuellement, déployer |

## En une phrase

Toute l'application tient dans `index.html` : React 18 + Babel standalone
chargés depuis un CDN, aucune dépendance npm, aucune étape de build.

Cette contrainte est volontaire et structure tout le reste — voir
[CLAUDE.md](../CLAUDE.md) pour les règles à respecter en contribuant.
