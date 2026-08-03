# Documentation — Skyjo Action

Documentation technique du projet. Pour l'usage courant, voir le
[README principal](../README.md).

## Sommaire

| Document | Contenu |
| --- | --- |
| [architecture.md](architecture.md) | Backend FastAPI + frontend JS natif : structure, routeurs, état, cycle de vie |
| [data-model.md](data-model.md) | Représentation d'une carte, d'une grille (frontend) et schéma SQLite (backend) |
| [game-rules.md](game-rules.md) | Les règles de Skyjo Action telles qu'implémentées, et celles qui ne le sont pas |
| [photo-scoring.md](photo-scoring.md) | Lecture d'une grille par photo : appel Claude côté serveur, prompt, sécurité |
| [ui-design.md](ui-design.md) | Palettes, code couleur des cartes et des joueurs, patterns d'interface |
| [development.md](development.md) | Lancer, modifier, tester manuellement, déployer |

## En une phrase

Un backend **FastAPI + SQLite** (`backend/`) possède l'état de jeu, le roster
de joueurs et la clé API Anthropic ; un frontend **JS natif sans build**
(`frontend/`) parle à ce backend en `/api/*`. Un seul process, un seul
container.

Cette séparation est volontaire et structure tout le reste — voir
[CLAUDE.md](../CLAUDE.md) pour les règles à respecter en contribuant.
