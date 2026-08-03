# Skyjo Action — Feuille de score

Une feuille de score pour le jeu de cartes **Skyjo Action**, en FastAPI +
SQLite côté serveur et JS natif côté client. Les parties survivent à un
rechargement de page et à un redémarrage du serveur.

En bonus, une photo de la grille d'un joueur peut être lue automatiquement par
Claude pour remplir les cartes et calculer le score de la manche.

## Utilisation

```bash
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux : source .venv/bin/activate
pip install -r backend/requirements.txt
python server.py
```

Ouvre <http://localhost:8000> : FastAPI sert l'interface et l'API depuis la
même origine. Voir [docs/development.md](docs/development.md) pour le détail
(pas de rechargement automatique, où vit la base SQLite, etc.) et pour le
déploiement en conteneur (`Dockerfile` à la racine, prêt pour Coolify ou
équivalent).

### Déroulé d'une partie

1. **Setup** — choisis les joueurs (2 à 8). Les noms habituels sont proposés en un
   tap, sinon tu saisis le nom que tu veux.
2. **Manche** — pour chaque joueur, entre son score de fin de manche :
   - 📷 **photo** de la grille (lecture automatique par Claude),
   - 🧮 **grille** 3×4 à remplir carte par carte (chiffres et Étoile), le total
     se calcule tout seul,
   - ✏️ **saisie directe** du total si tu as déjà compté.
3. **Validation** — l'app demande qui a terminé la manche (celui qui a retourné
   toutes ses cartes) et applique la règle du doublement si nécessaire.
4. **Fin** — dès qu'un joueur atteint **100 points**, la partie s'arrête. Le score
   le plus bas gagne. Tu peux enchaîner sur une revanche ou une nouvelle partie.

Le 🏆 affiche le classement à tout moment, le 🗓️ l'historique manche par manche.

### Fonction photo (optionnelle)

Pour lire une grille depuis une photo, il faut une clé API Anthropic, à coller
dans les réglages (icône 🔑). Elle est stockée **côté serveur** (base SQLite,
`backend/data/skyjo.db`) et configurée une seule fois pour toute l'instance —
elle n'est jamais renvoyée au navigateur ni exposée à un script qui
s'exécuterait sur la page. L'usage de l'API est facturé par Anthropic selon ta
consommation.

Sans clé, tout le reste de l'app fonctionne normalement : la calculatrice
grille et la saisie manuelle couvrent le score dans tous les cas.

> ⚠️ Une seule clé pour toute l'instance déployée. Ne la partage pas entre
> plusieurs foyers si tu héberges cette app pour plusieurs personnes. Voir
> [docs/photo-scoring.md](docs/photo-scoring.md).

## Documentation

- [docs/](docs/README.md) — index de la documentation
- [Architecture](docs/architecture.md) — backend/frontend, routeurs, état, cycle de vie
- [Modèle de données](docs/data-model.md) — grille, cartes, manches, schéma SQLite
- [Règles du jeu](docs/game-rules.md) — scoring tel qu'implémenté
- [Lecture photo](docs/photo-scoring.md) — appel Claude côté serveur, prompt, parsing
- [Développement](docs/development.md) — conventions, tests manuels, déploiement

## Licence

Projet personnel. Skyjo est une marque de Magilano ; ce projet n'est ni affilié
ni approuvé par l'éditeur.
