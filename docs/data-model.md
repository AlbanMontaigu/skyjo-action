# Modèle de données

## Carte

Le jeu de Skyjo contient des cartes de **−2 à 12** uniquement, plus une carte
Étoile qui vaut 0.

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

## Case de grille

Une case (`Cell`) contient l'une de ces quatre choses :

| Valeur | Signification | Compte au score |
| --- | --- | --- |
| `number` (−2…12) | Une carte face visible, valeur connue | oui |
| `STAR` (`"s"`) | La carte Étoile | oui, pour 0 |
| `REMOVED` (`"x"`) | Cette position n'existe plus | non |
| `null` | Carte présente mais pas encore saisie | non |

Deux helpers tranchent partout dans le code :

```js
const isCard    = (v) => typeof v === "number" || v === STAR;
const cardValue = (v) => (typeof v === "number" ? v : 0);
```

La distinction `null` / `REMOVED` est importante : `null` veut dire « il reste
quelque chose à saisir », `REMOVED` veut dire « il n'y a plus rien à cet
emplacement ». C'est ce qui permet d'afficher un compteur honnête —
`8/9 cartes (3 retirées)` plutôt que `8/12`.

## Grille

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

Les positions sont **fixes** : une colonne défaussée ne décale pas les autres,
ses trois cases passent simplement à `REMOVED`. C'est ce qui permet à la lecture
photo de renvoyer une position exacte, et à la grille affichée de rester
superposable à la grille réelle.

### Retrait d'une colonne / d'une ligne

Le retrait n'est jamais unitaire : `toggleColumnRemoved` et `toggleRowRemoved`
marquent les 3 ou 4 cases d'un coup, et le second appel les remet à `null`
(« Rétablir »). Cela reflète directement la règle du jeu — on ne défausse pas
une carte isolée, on défausse une colonne ou une ligne entière de cartes
identiques.

## Joueur

```js
{ id: "a3f9c1x", name: "Chaton" }
```

`id` vient de `uid()` (`Math.random().toString(36)`), suffisant pour une clé
React locale. La couleur n'est pas stockée : elle est dérivée de l'index dans
`players` via `playerColor(i)`, ce qui garantit qu'elle reste stable tant que
l'ordre ne change pas.

- `MAX_PLAYERS = 8`, minimum 2 (le bouton de retrait disparaît à 2).
- `DEFAULT_NAMES = ["Chaton", "Minou"]` — les deux joueurs habituels, préremplis.
- Au-delà : `Joueur 3`, `Joueur 4`…
- `KNOWN_NAMES` est la liste proposée en un tap dans le sélecteur de nom. Un nom
  déjà pris apparaît grisé et non cliquable.

## Manche

```js
{
  scores: { [playerId]: number },   // scores finaux, doublement déjà appliqué
  closerId: "a3f9c1x",              // qui a retourné toutes ses cartes
  closerDoubled: true,              // le doublement a-t-il été appliqué
}
```

`rounds` est **append-only** : aucune manche n'est modifiée ou supprimée après
validation. `closerDoubled` n'est pas recalculable a posteriori (le score
d'origine n'est pas conservé), il est donc stocké — c'est ce qui permet à
l'historique d'afficher le `×2`.

## Constantes

| Constante | Valeur | Rôle |
| --- | --- | --- |
| `MAX_PLAYERS` | `8` | Limite de joueurs |
| `TARGET` | `100` | Seuil de fin de partie |
| `STAR` | `"s"` | Carte Étoile |
| `REMOVED` | `"x"` | Position défaussée |
| `API_KEY_STORAGE` | `"skyjo_action_anthropic_api_key"` | Clé `localStorage` |
| `PLAYER_COLORS` | 8 couleurs | Une par joueur, voir [ui-design.md](ui-design.md) |
