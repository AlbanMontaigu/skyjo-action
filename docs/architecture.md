# Architecture

## Vue d'ensemble

```
backend/                  FastAPI + SQLite -- source de vérité de l'état
  main.py                 crée l'app, initialise la DB, monte les routers + le frontend statique
  db.py                   connexion sqlite3 (stdlib), pas d'ORM
  schema.sql               CREATE TABLE + seed du roster de joueurs connus
  routers/
    settings.py            clé API Anthropic (write-only côté client)
    players.py              roster de joueurs connus
    games.py                cycle de vie d'une partie, règle du doublement
    vision.py                appel Claude vision, prompt, schéma structuré (Étoile incluse)
  requirements.txt

frontend/                 JS natif, aucune étape de build
  index.html               squelette <div id="app">, <script type="module">
  css/style.css             styles statiques
  js/
    domain.js               constantes & helpers du domaine (STAR, REMOVED, band, cardValue…)
    icons.js                icônes SVG inline (fonctions -> markup)
    api.js                    wrappers fetch() vers le backend
    state.js                  état global + render()
    events.js                 délégation d'événements + tous les handlers
    views/
      header.js, setup.js, playing.js
    modals.js                les 9 modales
    util.js                   escapeHtml()
    app.js                    séquence de démarrage
```

Aucune transpilation, aucun bundler : le navigateur charge les modules ES tels
quels, servis statiquement par FastAPI.

## Rendu, côté frontend

Pas de virtual DOM, pas de diffing. Le patron est :

```
state (state.js)  →  render()  →  #app.innerHTML
```

`render()` reconstruit l'intégralité du HTML de `#app` à partir de `state` à
chaque changement **structurel** (changement de phase, ouverture/fermeture d'une
modale, ajout/retrait d'un joueur, manche validée). C'est le même modèle "tout
recalculer depuis l'état" que la version React précédente, sans JSX ni
bibliothèque de diff.

### Délégation d'événements

Les clics et changements sont écoutés **une seule fois**, sur `#app`
(`events.js`), via des attributs `data-action` lus dans un handler délégué. Ça
survit à un remplacement d'`innerHTML` sans avoir à réattacher quoi que ce soit
après chaque rendu.

### Saisie texte/nombre

Les champs texte/nombre (`data-bind`) écrivent directement dans `state` sur
l'événement `input`, **sans appeler `render()`**. C'est ce qui préserve la
position du curseur pendant la frappe, puisque le nœud DOM n'est jamais touché.
Le prochain rendu structurel reflète la dernière valeur tapée, puisque toutes
les fonctions de rendu lisent `state` directement, jamais une closure figée.

## Arbre de rendu (frontend)

```
render()                          state.js
├── renderHeader()                 views/header.js
├── renderSetupPhase()              views/setup.js       (si phase === "setup")
├── renderPlayingPhase()            views/playing.js     (si phase === "playing")
└── modales, rendues conditionnellement, une fonction par modale : modals.js
    ├── CloserModal, CardValueModal      (valeur de case, retrait colonne ET ligne)
    ├── PhotoSourceModal, PhotoReviewModal
    ├── RankingModal, HistoryModal
    ├── ConfirmNewGameModal, SettingsModal
    └── NamePickerModal
```

Toutes les modales suivent le même patron : un overlay plein écran
(`data-overlay`, ferme au clic direct dessus) autour d'une carte ancrée en bas
(`modal-card`). Un clic à l'intérieur de la carte ne ferme jamais la modale, car
le handler délégué s'arrête au premier ancêtre `[data-action]` rencontré — voir
`events.js`.

## État (frontend)

Tout vit dans l'objet `state` (`state.js`). Pas de contexte, pas de store
externe.

| State | Rôle |
| --- | --- |
| `phase` | `"setup" \| "playing"` |
| `setupPlayers` | joueurs en cours de saisie, ids locaux (`uid()`), avant qu'une partie existe côté serveur |
| `players`, `rounds`, `totals`, `gameOver` | reflet direct de ce que renvoie le backend pour la partie active |
| `draft`, `pendingScores`, `error` | manche en cours de saisie |
| `calcCards`, `calcOpenId`, `cellModal`, `manualOpenId` | calculatrice grille |
| `photoLoading`, `photoError`, `photoSourceFor`, `photoReviewFor` | lecture photo |
| `showCloserModal`, `showRanking`, `showHistory`, `showSettings`, `confirmNewGame`, `pickerFor` | visibilité des modales |
| `knownPlayers`, `hasApiKey` | chargés au démarrage depuis le backend |

Une fois qu'une partie existe côté serveur, `players`/`rounds`/`totals` viennent
**toujours** de la dernière réponse du backend (`POST /api/games`, `POST
/api/games/{id}/rounds`, etc.) — le frontend ne recalcule ni la règle du
doublement ni la fin de partie, il affiche ce qu'on lui renvoie. `calcCards`
(la grille 3×4 par joueur) reste, elle, un état purement frontend : c'est un
assistant de saisie, pas une donnée persistée — seul le total qu'il produit
part vers le backend.

## Le backend est la source de vérité

Contrairement à la version précédente (tout en mémoire dans le composant React),
la logique de jeu vit maintenant côté serveur :

- `POST /api/games/{id}/rounds` applique la règle du doublement et détecte la
  fin de partie (`game_over`) -- voir `backend/routers/games.py`.
- `GET /api/games/active` permet de **reprendre une partie en cours** au
  chargement de la page (voir `frontend/js/app.js`), ce qui corrige la limite la
  plus gênante de l'ancienne version : un rechargement ne perd plus la partie.

Le STAR et le retrait colonne/ligne n'existent que côté frontend, dans
`calcCards` : ce sont des aides de saisie pour obtenir un total. Le backend ne
voit jamais qu'un entier par joueur et par manche.

### Référence des endpoints

| Méthode & chemin | Fichier | Rôle |
| --- | --- | --- |
| `GET /api/settings` | `routers/settings.py` | `{has_api_key}` -- jamais la clé elle-même |
| `PUT /api/settings/api-key` | `routers/settings.py` | Enregistre la clé Anthropic |
| `DELETE /api/settings/api-key` | `routers/settings.py` | Retire la clé |
| `GET /api/players/known` | `routers/players.py` | Noms du roster, pour le sélecteur |
| `GET /api/games/active` | `routers/games.py` | La partie `playing` en cours, ou `null` -- utilisé au démarrage pour reprendre |
| `POST /api/games` | `routers/games.py` | Crée une partie (`{players: [name...]}`), ajoute les noms inconnus au roster |
| `POST /api/games/{id}/rounds` | `routers/games.py` | Valide une manche (`{scores, closer_game_player_id}`), applique le doublement, détecte la fin de partie |
| `POST /api/games/{id}/end` | `routers/games.py` | Marque une partie `finished` (utilisé par « Nouvelle partie ») |
| `POST /api/games/{id}/rematch` | `routers/games.py` | Nouvelle partie, mêmes joueurs, manches remises à zéro |
| `POST /api/vision/read-grid` | `routers/vision.py` | Photo (`multipart/form-data`, champ `image`) → `{grid: [12 cases]}`, cases pouvant valoir `"s"` (Étoile) |

Toutes les réponses de `routers/games.py` passent par `serialize_game()`, qui
renvoie la même forme complète (`id`, `status`, `players`, `rounds`, `totals`,
`game_over`) -- le frontend n'a jamais besoin de fusionner une réponse partielle
avec l'état qu'il avait déjà. `/docs` (Swagger UI généré par FastAPI) donne le
détail exact des schémas de requête/réponse.

## Flux d'une manche

```
resetRoundForm()          réinitialise draft + tous les panneaux/erreurs (events.js)
   │
   ├─ saisie : photo → readGridFromPhoto() → PhotoReviewModal → calcCards → syncDraft
   ├─ saisie : grille → CardValueModal (STAR, colonne, ligne) → calcCards → syncDraft
   └─ saisie : manuelle → draft directement (data-bind, sans render())
   │
openCloserModal()         valide que chaque score est un nombre → pendingScores
   │
finalizeRound(id)          POST /api/games/{id}/rounds -- le backend applique le
   │                       doublement et renvoie l'état à jour
resetRoundForm()           manche suivante
```

## Persistance

Voir [data-model.md](data-model.md) pour le schéma complet. En résumé :
`settings` (clé API), `roster_players` (noms connus), `games` /
`game_players` / `rounds` / `round_scores` (une partie et son historique complet,
manche par manche).

## Limites connues

- **Pas d'annulation.** Une manche validée n'est jamais modifiée ni supprimée ;
  une erreur validée par erreur ne peut être corrigée qu'en démarrant une
  nouvelle partie.
- **Pas d'authentification.** Un seul foyer/instance = une seule "partie active"
  globale ; pas de notion d'utilisateur.
- **Clé API en clair en base.** Voir [photo-scoring.md](photo-scoring.md) --
  c'est strictement mieux que l'ancien `localStorage` (jamais exposée au
  navigateur), mais toujours pas chiffrée sur disque.
