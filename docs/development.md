# Développement

## Lancer

```bash
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux : source .venv/bin/activate
pip install -r backend/requirements.txt
python server.py
```

Le venv vit à la racine (`.venv/`), pas dans `backend/` : `server.py`, le point
d'entrée qu'on invoque réellement, est lui-même à la racine, donc tout se
lance depuis là sans naviguer entre dossiers. `server.py` lance
`uvicorn backend.main:app` sur `0.0.0.0:8000` (accessible depuis le réseau
local -- pratique pour tester la photo depuis un téléphone). `backend` est un
vrai package Python (`backend/__init__.py`, imports relatifs dans `main.py` et
`routers/`), donc tout se lance depuis la racine du dépôt -- équivalent à
`uvicorn backend.main:app`, en plus court à retenir.

Pas de rechargement automatique (`--reload`) : ça fait tourner un watcher de
fichiers en continu pour un usage local ponctuel. Après une modification,
relance simplement le process (Ctrl+C puis renvoie la commande).

Ouvre <http://localhost:8000>. FastAPI sert `frontend/` en statique et l'API sous
`/api/*` depuis la même origine -- pas de CORS à gérer, pas de second serveur à
lancer.

La base SQLite se crée toute seule au premier démarrage, dans
`backend/data/skyjo.db` (ignorée par git). Pour repartir d'une base vide,
supprime simplement ce fichier et relance le serveur.

`/docs` (Swagger UI généré par FastAPI) est pratique pour appeler un endpoint
isolément pendant qu'on travaille sur le backend, sans repasser par l'interface.

## Modifier

### Backend (`backend/`)

- Pas de build, pas de rechargement automatique -- relance le process après
  chaque modification (voir « Lancer » ci-dessus).
- `backend` est un vrai package (`backend/__init__.py`,
  `backend/routers/__init__.py`) : les imports entre modules sont relatifs
  (`from .db import ...` dans `main.py`, `from ..db import ...` depuis un
  fichier de `routers/`). Un nouveau routeur doit suivre le même patron --
  pas d'import absolu `from db import ...` qui ne marcherait que si `backend/`
  est le répertoire courant.
- Un routeur par ressource (`routers/settings.py`, `players.py`, `games.py`,
  `vision.py`). La logique de jeu (règle du doublement, détection de fin de
  partie) vit dans `games.py` -- c'est la source de vérité, le frontend affiche
  ce qu'elle renvoie. Toutes les réponses passent par `serialize_game()`, qui
  renvoie toujours la forme complète d'une partie (voir la référence des
  endpoints dans [architecture.md](architecture.md)).
- Pas d'ORM : `sqlite3` (stdlib) + SQL brut dans `db.py` et chaque routeur. Le
  schéma complet est dans `schema.sql`.

### Frontend (`frontend/js/`)

Aucune étape de build : édite, sauvegarde, recharge la page.

- **Nouvelle icône** : ajoute une fonction dans `icons.js`, sur le patron des
  existantes (`svgIcon(inner, opts)`).
- **Nouveau champ interactif** : un attribut `data-action="mon-action"` (plus
  `data-*` pour les paramètres) sur l'élément, un handler dans le `handlers` map
  d'`events.js`. Ne réattache jamais un listener manuellement -- tout passe par
  la délégation sur `#app`.
- **Nouveau champ texte/nombre à saisie libre** : `data-bind="monChamp"`,
  géré par le listener `input` délégué dans `events.js`, qui écrit dans `state`
  **sans** appeler `render()` (voir `docs/architecture.md` -- c'est ce qui évite
  de perdre le focus/curseur en cours de frappe).
- **Nouvelle modale** : reprends le patron dans `modals.js` (overlay
  `data-overlay` + `modal-card`), ajoute son flag/valeur dans `state.js`, et
  branche son rendu conditionnel dans `render()` (toujours dans `state.js`).

### Toucher à la lecture photo

Le modèle, `max_tokens` et `output_config` sont liés : le raisonnement est actif
par défaut et partage le budget de jetons avec la réponse. Relis
[photo-scoring.md](photo-scoring.md) avant de toucher à l'un des trois. Le code
vit dans `backend/routers/vision.py`.

### Toucher aux scores

Relis d'abord [game-rules.md](game-rules.md). La règle du doublement et la
détection de fin de partie vivent dans `backend/routers/games.py`
(`submit_round`) -- c'est le seul endroit qui doit les implémenter. Le calcul
d'un total de manche (Étoile, retrait colonne/ligne) reste côté frontend
(`frontend/js/domain.js`) puisqu'il ne produit qu'un entier avant d'être
envoyé au backend.

## Tester

Il n'y a pas de tests automatisés.

### Checklist manuelle

À dérouler après toute modification du scoring, de la grille ou de l'état.

**Setup**
- [ ] Ajouter jusqu'à 8 joueurs, le bouton disparaît à 8.
- [ ] Retirer un joueur ; à 2 joueurs le bouton de retrait disparaît.
- [ ] Un nom déjà pris est grisé dans le sélecteur.
- [ ] Démarrer sans saisir de nom → « Chaton », « Minou », « Joueur 3 »…

**Manche**
- [ ] Grille : saisir des cartes, le total suit à chaque tap.
- [ ] Grille : Étoile → affiche `★`, compte 0.
- [ ] Grille : le pavé propose bien −2 à 12 et l'Étoile, rien d'autre.
- [ ] Grille : retirer une colonne → 3 cases en pointillés, compteur
      `n/9 (3 retirées)`, total inchangé.
- [ ] Grille : retirer une ligne → 4 cases en pointillés, compteur
      `n/8 (4 retirées)`, total inchangé.
- [ ] Retirer puis rétablir (colonne ou ligne) revient à l'état vide.
- [ ] « Effacer » remet la grille à zéro et vide le score.
- [ ] Saisie manuelle : accepte un négatif, écrase le total de la grille.
- [ ] Valider avec un score manquant → message d'erreur, pas de progression.

**Fin de manche**
- [ ] Closer strictement le plus bas → **pas** de doublement.
- [ ] Closer à égalité avec un autre → doublement (l'égalité ne protège pas).
- [ ] L'historique affiche `×2` sur la bonne case.

**Fin de partie**
- [ ] Atteindre 100 → le classement s'ouvre tout seul, bandeau « Partie
      terminée », le plus bas total est premier.
- [ ] « Revanche » garde les joueurs et remet les scores à zéro.
- [ ] « Nouvelle partie » demande confirmation si des manches sont jouées.

**Persistance** (nouveau par rapport à l'ancienne version)
- [ ] Recharger la page en cours de manche → la partie reprend telle quelle.
- [ ] Couper puis relancer `uvicorn` en cours de partie → même chose.

**Photo** (nécessite une clé API)
- [ ] Sans clé → invite + ouverture des réglages, aucun appel réseau.
- [ ] Clé invalide → message dédié « clé invalide ou refusée ».
- [ ] Photo lisible → modale de revue, grille et total cohérents.
- [ ] Photo d'une grille avec une carte Étoile → détectée comme `★`, pas `0`.
- [ ] « Corriger » ouvre la calculatrice sur le bon joueur.
- [ ] Fermer la revue d'un clic à côté conserve le score.

### Débogage

Pas de source maps à chercher : c'est du JS natif, les numéros de ligne des
erreurs de la console correspondent exactement au fichier source. Les erreurs
réseau (endpoint qui échoue, 4xx/5xx) sont visibles dans l'onglet Réseau des
devtools et dans les logs `uvicorn`.

## Déployer

Ce n'est plus un fichier statique : il faut un process Python qui tourne. Le
`Dockerfile` à la racine construit une seule image qui sert à la fois l'API et
le frontend statique (`backend/main.py` monte `frontend/` en statique) :

```bash
docker build -t skyjo-action .
docker run -p 8000:8000 -v skyjo-action-data:/app/backend/data skyjo-action
```

Le point important est le **volume monté sur `/app/backend/data`** : c'est là
que vit `skyjo.db` (voir `backend/db.py`). Sans volume persistant, chaque
redéploiement repart d'une base vide -- parties et clé API perdues.

### Coolify

1. Nouvelle ressource → "Dockerfile" (Coolify le détecte automatiquement à la
   racine du repo, pas besoin de buildpack/Nixpacks).
2. **Storage** → ajouter un volume, chemin conteneur `/app/backend/data`.
   Coolify gère le chemin hôte automatiquement.
3. **Ports** → exposer `8000` (le `Dockerfile` lit `$PORT` s'il est défini,
   sinon retombe sur `8000` -- utile si Coolify impose son propre port).
4. Pas de variable d'environnement obligatoire : la clé API Anthropic se
   configure depuis l'interface (🔑), pas via l'environnement du conteneur.
5. Domaine/HTTPS : géré par le proxy Coolify comme pour n'importe quelle autre
   app -- rien de spécifique à cette app côté certificat/reverse proxy.

Sans le volume à l'étape 2, l'app fonctionne mais perd tout son état à chaque
redéploiement -- c'est la seule chose à ne pas oublier.

`frontend/build.txt` vaut `dev` dans le repo ; le `Dockerfile` l'écrase avec la
date/heure du build à l'image. Le frontend affiche ce contenu en pied de page
discret, ce qui permet de distinguer un déploiement Docker (date/heure) d'un
lancement en local (`dev`).

Ne commite jamais une clé API. Elle se saisit dans l'interface et vit dans
`backend/data/skyjo.db` (ignoré par git, et donc absent de l'image elle-même —
voir [photo-scoring.md](photo-scoring.md)).

## Pistes

Non implémenté à ce jour, par ordre d'utilité perçue :

- **Annuler la dernière manche** — `rounds` est append-only, une faute de frappe
  validée oblige à recommencer.
- **Parcourir l'historique des parties terminées** — la donnée existe déjà en
  base (`games.status = 'finished'`), mais il n'y a pas encore d'écran pour la
  consulter.
- **Chiffrer la clé API au repos** — elle est en clair dans `settings.value`.
