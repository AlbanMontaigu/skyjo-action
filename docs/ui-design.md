# Interface et design

## Intention

Une feuille de score qu'on tient d'une main, à table, avec des mains parfois
occupées. D'où : une colonne unique de 480 px max, des cibles tactiles larges,
des modales ancrées en bas d'écran (à portée du pouce) plutôt que centrées.

Le ton visuel reprend celui du jeu : fond crème chaud, rouge carte à jouer pour
les actions principales, jaune doré pour les états actifs et les rappels.

## Deux palettes, deux significations

C'est la distinction la plus importante de l'interface, et elle est délibérée.

### `band(v)` — la couleur d'une **carte**, selon sa valeur

Reprend le code couleur du vrai jeu. Utilisée sur la grille, le pavé de saisie
et les pastilles de l'historique.

| Valeur | Fond | Texte |
| --- | --- | --- |
| Étoile | dégradé arc-en-ciel | blanc |
| −2, −1 | `#1b3a6b` bleu foncé | `#dbe7ff` |
| 0 | `#1f8fa3` cyan | `#e6fbff` |
| 1 à 4 | `#2f8f4f` vert | `#eafff0` |
| 5 à 8 | `#e0ab1f` jaune | `#3a2900` |
| 9 à 12 | `#c23b3b` rouge | `#fff0ee` |

C'est le même code couleur que celui exploité par le prompt de lecture photo —
voir [photo-scoring.md](photo-scoring.md). La carte Étoile porte en plus un
`textShadow` pour que le `★` blanc reste lisible sur le dégradé.

### `PLAYER_COLORS` — la couleur d'un **joueur**

Volontairement une palette différente (pastels froids et chauds), pour qu'on ne
confonde jamais « cette couleur dit la valeur d'une carte » et « cette couleur
dit à qui appartient cette ligne ».

```js
["#4fc3f7", "#f06292", "#aed581", "#ffb74d",
 "#ba68c8", "#4db6ac", "#ff8a65", "#dce775"]
```

Attribuée par index (`playerColor(i)`, modulo la longueur) et appliquée
partout où un nom apparaît : pastille d'avatar au setup, point devant la ligne
de score, en-tête de colonne dans l'historique, bordure gauche des lignes de
classement et des boutons de choix du closer. Un coup d'œil suffit pour savoir
à qui appartient un score.

## Patron de modale

Toutes les modales partagent la même structure :

```jsx
<div style={styles.modalOverlay} onClick={onClose}>
  <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
    <button style={styles.modalCloseBtn}>×</button>
    …
  </div>
</div>
```

- `modalOverlay` : plein écran, fond assombri + `backdrop-filter`, ferme au clic.
- `modalCard` : ancrée en bas (`alignItems: "flex-end"`), coins arrondis en
  haut seulement, `maxHeight: 88vh` avec défilement interne.
- `stopPropagation` sur la carte, pour qu'un clic dedans ne ferme pas.

Une exception : `PhotoReviewModal` n'a pas de bouton `×` — cliquer à côté vaut
« Correct », puisque les données sont déjà appliquées.

## Grille de cartes

`boardGrid` est une grille CSS `repeat(4, 1fr)` × `repeat(3, 1fr)`, chaque case
en `aspectRatio: "2 / 3"` — les proportions d'une vraie carte. Les états :

| État | Rendu |
| --- | --- |
| Vide (`null`) | fond translucide, bordure pleine, aucun contenu |
| Carte | fond `band(v)`, valeur en Baloo 2 gras |
| Étoile | dégradé arc-en-ciel, `★`, ombre portée sur le texte |
| Retirée (`REMOVED`) | bordure **en pointillés**, opacité 0,5, `×` |

Le pointillé + la transparence disent « cette position n'existe plus » sans
casser l'alignement de la grille — les positions restent fixes.

## Styles

Tous les styles vivent dans l'objet `styles` en bas du script, appliqués en
`style={}`. Le `<style>` du `<head>` ne contient que ce que les styles inline ne
savent pas exprimer :

- `@import` des polices (Baloo 2 pour les titres et les chiffres, Inter pour le
  texte),
- `@keyframes skyjo-spin` + `.spin` pour le loader de la photo,
- `.card-btn:active` — le petit enfoncement au tap, qui donne le retour tactile,
- le reset `box-sizing` et les marges.

Conséquence pratique : **pas de media query, pas de `:hover`**. L'app est pensée
mobile d'abord, et le `:active` sur `.card-btn` couvre le seul retour visuel qui
compte au doigt.

## Accessibilité

Ce qui est fait : `aria-label` sur tous les boutons-icône, `aria-expanded` sur le
bouton de saisie manuelle, `lang="fr"` sur le document, `viewport-fit=cover`
pour les encoches.

Ce qui ne l'est pas : les modales ne piègent pas le focus et ne se ferment pas à
`Échap`, et la couleur est parfois le seul porteur d'information (les tranches
de valeur des cartes) — atténué par le fait que la valeur est toujours écrite
en toutes lettres sur la carte.
