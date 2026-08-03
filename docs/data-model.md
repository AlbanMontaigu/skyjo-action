# Modèle de données

## Carte

Le jeu de Skyjo Action contient des cartes de **−2 à 12** uniquement, plus une
carte Étoile qui vaut 0.

```js
const STAR = "s";
const CARD_VALUES = [-2, -1, 0, STAR, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
```

### Pourquoi `STAR` et pas `0`

La carte Étoile vaut 0 au score, mais c'est une carte **physiquement différente**
du 0 bleu clair : fond arc-en-ciel, une grande étoile, aucun chiffre imprimé.

Les garder distinctes n'a aucun effet sur le calcul (`cardValue(STAR) === 0`)
mais permet à la grille affichée de correspondre exactement à ce que le joueur a
posé sur la table. C'est le point de repère qui rend la relecture possible : si
l'écran affiche `★` là où la table montre `0`, on sait que la lecture est fausse.

## Case de grille (frontend uniquement)

Une case (`Cell`) est un état purement côté frontend — c'est l'assistant de
calcul (`frontend/js/domain.js`, `state.calcCards`), pas quelque chose que le
backend stocke. Elle contient l'une de ces quatre choses :

| Valeur | Signification | Compte au score |
| --- | --- | --- |
| `number` (−2…12) | Une carte face visible, valeur connue | oui |
| `STAR` (`"s"`) | La carte Étoile | oui, pour 0 |
| `REMOVED` (`"x"`) | Cette position n'existe plus | non |
| `null` | Carte présente mais pas encore saisie | non |

Trois helpers tranchent partout dans le code (`domain.js`) :

```js
const isCard    = (v) => typeof v === "number" || v === STAR;
const cardValue = (v) => (typeof v === "number" ? v : 0);
const gridSum   = (grid) => grid.reduce((a, b) => a + (isCard(b) ? cardValue(b) : 0), 0);
```

La distinction `null` / `REMOVED` est importante : `null` veut dire « il reste
quelque chose à saisir », `REMOVED` veut dire « il n'y a plus rien à cet
emplacement ». C'est ce qui permet d'afficher un compteur honnête —
`8/9 cartes (3 retirées)` plutôt que `8/12`.

## Grille (frontend uniquement)

Un tableau **plat de 12 cases**, représentant une grille 3 lignes × 4 colonnes
lue de gauche à droite puis de haut en bas.

```
index :  0  1  2  3
         4  5  6  7
         8  9 10 11

ligne de l'index i   = Math.floor(i / 4)
colonne de l'index i = i % 4
colonne c            = [c, c + 4, c + 8]
ligne l              = [l*4, l*4+1, l*4+2, l*4+3]
```

Les positions sont **fixes** : une colonne ou une ligne défaussée ne décale pas
les autres, ses cases passent simplement à `REMOVED`. C'est ce qui permet à la
lecture photo de renvoyer une position exacte, et à la grille affichée de rester
superposable à la grille réelle.

### Retrait d'une colonne / d'une ligne

Le retrait n'est jamais unitaire : `toggle-column` et `toggle-row` (handlers
dans `frontend/js/events.js`) marquent les 3 ou 4 cases d'un coup, et un second
appel les remet à `null` (« Rétablir »). Cela reflète directement la règle du
jeu — on ne défausse pas une carte isolée, on défausse une colonne (3 cartes
identiques) ou une ligne (4 cartes identiques) entière.

Une fois que le joueur (ou la lecture photo) a rempli la grille, seul le total
(`gridSum`) traverse la frontière réseau : le backend ne reçoit qu'un entier
par joueur, jamais la grille elle-même.

## Persistance (backend)

Toute la donnée qui doit survivre à un rechargement ou un redémarrage vit dans
SQLite (`backend/schema.sql`), lue/écrite via `sqlite3` brut (`backend/db.py`),
sans ORM.

### `settings`

```sql
settings(key TEXT PRIMARY KEY, value TEXT)
```

Une seule clé utilisée aujourd'hui : `anthropic_api_key`. Voir
[photo-scoring.md](photo-scoring.md).

### `roster_players`

```sql
roster_players(id INTEGER PRIMARY KEY, name TEXT UNIQUE)
```

Les noms proposés en un tap dans le sélecteur de joueur. Seedé avec l'ancienne
liste `KNOWN_NAMES` codée en dur, et complété automatiquement à chaque `POST
/api/games` avec les noms encore inconnus.

### `games` / `game_players`

```sql
games(id, status,        -- 'playing' | 'finished'
      target_score,      -- 100 par défaut
      created_at, finished_at)

game_players(id, game_id, name, position)
```

`position` (0-indexé) fait le même travail que l'ordre du tableau `players` de
l'ancienne version : nom par défaut ("Chaton"/"Minou"/"Joueur N") et index dans
`PLAYER_COLORS`, côté frontend.

### `rounds` / `round_scores`

```sql
rounds(id, game_id, round_number,
       closer_game_player_id, closer_doubled)   -- 0/1

round_scores(id, round_id, game_player_id, score)
```

Équivalent relationnel de l'ancienne manche en mémoire :

```js
{ scores: {playerId: number}, closerId, closerDoubled }
```

`rounds`/`round_scores` sont **append-only** : `submit_round()`
(`backend/routers/games.py`) ne fait qu'insérer, jamais mettre à jour ou
supprimer une manche existante — pas d'annulation. `closer_doubled` n'est pas
recalculable a posteriori (le score d'origine, avant doublement, n'est pas
conservé séparément), il est donc stocké tel quel — c'est ce qui permet à
l'historique d'afficher le `×2`.

## Joueur

Côté backend, un joueur est une ligne `game_players` : `{id, name, position}`,
`id` étant le `game_player_id` auto-incrémenté par SQLite (pas un `uid()`
côté client comme dans l'ancienne version). Côté frontend, avant qu'une partie
existe, `state.setupPlayers` utilise des ids locaux (`uid()`,
`Math.random().toString(36)`) le temps de la saisie des noms.

- `MAX_PLAYERS = 8`, minimum 2 (le bouton de retrait disparaît à 2).
- `DEFAULT_NAMES = ["Chaton", "Minou"]` — les deux joueurs habituels, préremplis.
- Au-delà : `Joueur 3`, `Joueur 4`…
- La couleur n'est pas stockée : elle est dérivée de l'index dans la liste de
  joueurs affichée via `playerColor(i)`, ce qui garantit qu'elle reste stable
  tant que l'ordre ne change pas.

## Constantes

| Constante | Valeur | Rôle |
| --- | --- | --- |
| `MAX_PLAYERS` | `8` | Limite de joueurs |
| `TARGET` / `target_score` | `100` | Seuil de fin de partie (côté backend, par partie) |
| `STAR` | `"s"` | Carte Étoile (frontend uniquement) |
| `REMOVED` | `"x"` | Position défaussée (frontend uniquement) |
| `PLAYER_COLORS` | 8 couleurs | Une par joueur, voir [ui-design.md](ui-design.md) |
