# Architecture

## Vue d'ensemble

Un seul fichier : `index.html` (~1300 lignes). Il contient successivement :

```
<head>
  <style>            reset minimal, @import des polices, @keyframes, :active
</head>
<body>
  <div id="root">
  <script src=unpkg>  react, react-dom, @babel/standalone
  <script type="text/babel">
    icônes SVG inline
    constantes & helpers du domaine
    VISION_PROMPT
    SkyjoScorer          <- tout l'état
    Header, SetupPhase, PlayingPhase
    *Modal               <- 8 modales
    styles               <- objet de styles inline
    ReactDOM.createRoot(...).render(<SkyjoScorer />)
</body>
```

Babel transpile le JSX **dans le navigateur** au chargement. C'est plus lent
qu'un bundle, mais c'est ce qui permet le double-clic sans outillage.

## Arbre de composants

```
SkyjoScorer                     état global, tous les handlers
├── Header                      logo, titre, actions (🏆 🗓️ ↻ 🔑)
├── SetupPhase                  phase === "setup"
│   └── NamePickerModal         choix du nom d'un joueur
├── PlayingPhase                phase === "playing"
│   └── (grille 3×4 inline par joueur)
└── modales, rendues conditionnellement en frères
    ├── CloserModal             « qui a fini la manche ? »
    ├── CardValueModal          valeur d'une case + retrait colonne/ligne
    ├── PhotoSourceModal        appareil photo ou galerie
    ├── PhotoReviewModal        vérification de la grille détectée
    ├── RankingModal            classement / podium de fin
    ├── HistoryModal            tableau manche par manche
    ├── ConfirmNewGameModal     garde-fou avant effacement
    └── SettingsModal           clé API Anthropic
```

Toutes les modales suivent le même patron : un `modalOverlay` plein écran qui
ferme au clic, une `modalCard` ancrée en bas (feuille façon mobile) qui stoppe
la propagation, et un bouton `×` en haut à droite. Aucune n'utilise de portail.

## État

Tout l'état est dans `SkyjoScorer`. Les composants enfants sont présentationnels
et reçoivent des props — il n'y a ni contexte, ni reducer, ni store externe.

### État de partie

| State | Type | Rôle |
| --- | --- | --- |
| `phase` | `"setup" \| "playing"` | Écran courant |
| `players` | `[{id, name}]` | 2 à 8 joueurs, ordre stable |
| `rounds` | `[{scores, closerId, closerDoubled}]` | Manches jouées, append-only |
| `draft` | `{playerId: string}` | Scores de la manche en cours, en saisie |
| `pendingScores` | `{playerId: number} \| null` | Scores validés, en attente du closer |

### État d'interface

`showCloserModal`, `showRanking`, `showHistory`, `showSettings`,
`confirmNewGame`, `error`, `calcOpenId`, `manualOpenId`, `cellModal`,
`photoSourceFor`, `photoReviewFor`.

La plupart sont soit un booléen, soit un `playerId | null` — « quel joueur a ce
panneau ouvert », ce qui garantit qu'un seul panneau est ouvert à la fois.

### État de la calculatrice

| State | Type | Rôle |
| --- | --- | --- |
| `calcCards` | `{playerId: Cell[12]}` | Grille 3×4 aplatie, par joueur |
| `photoLoading` | `{playerId: bool}` | Spinner pendant l'appel API |
| `photoError` | `{playerId: string}` | Message d'erreur sous la ligne du joueur |

### Persistance

Une seule chose survit au rechargement : la clé API, dans `localStorage` sous
`skyjo_action_anthropic_api_key`. **Les scores ne sont pas persistés** — un
rafraîchissement perd la partie en cours. Voir « Limites connues » plus bas.

## Valeurs dérivées

Calculées avec `useMemo`, jamais stockées :

- `colorFor` — `playerId → couleur`, par index dans `players`.
- `totals` — somme des scores de chaque joueur sur toutes les manches.
- `gameOver` — vrai dès qu'un total atteint `TARGET` (100).
- `sortedPlayers` — classement par total croissant (le plus bas gagne).

Un seul `useEffect` dans toute l'app : ouvrir le classement quand `gameOver`
passe à vrai.

## Flux d'une manche

```
openRoundForm()      réinitialise draft + tous les panneaux/erreurs
   │
   ├─ saisie : photo → PhotoReviewModal → calcCards → syncDraft
   ├─ saisie : grille → CardValueModal → calcCards → syncDraft
   └─ saisie : manuelle → draft directement
   │
openCloserModal()    valide que chaque score est un nombre → pendingScores
   │
finalizeRound(id)    applique la règle du doublement → push dans rounds
   │
openRoundForm()      manche suivante
```

`syncDraft` est le point de jonction entre la grille et le score : à chaque
modification de `calcCards[playerId]`, il recalcule la somme et l'écrit dans
`draft[playerId]`. La saisie manuelle écrit dans `draft` sans toucher à la
grille — les deux sources coexistent, la dernière écriture gagne.

## Le piège des `setState` asynchrones

Toutes les écritures dans `calcCards`, `draft`, `photoLoading` et `photoError`
utilisent la forme fonctionnelle :

```js
setCalcCards((prev) => ({ ...prev, [playerId]: next }));   // ✅
setCalcCards({ ...calcCards, [playerId]: next });          // ❌
```

Ces objets sont indexés par joueur, et la lecture photo d'un joueur se résout de
façon asynchrone. Avec la seconde forme, une modification synchrone sur un
**autre** joueur pendant l'appel API écraserait silencieusement le résultat de
la photo. Un commentaire dans le source rappelle cette contrainte ; c'est le
piège le plus facile à réintroduire par accident.

Lire `calcCards[playerId]` depuis la closure reste correct : rien d'autre ne
peut toucher cette clé précise pendant un clic synchrone.

## Limites connues

- **Aucune persistance des scores.** Recharger la page perd la partie.
- **Pas d'annulation.** `rounds` est append-only ; une manche validée avec une
  erreur ne peut pas être corrigée, seulement recommencée depuis zéro.
- **Transpilation au chargement.** Babel standalone ajoute un délai visible au
  premier affichage, surtout sur mobile.
- **Clé API côté client.** Voir [photo-scoring.md](photo-scoring.md).
