# Règles du jeu, telles qu'implémentées

Ce document décrit ce que l'application calcule. Il ne remplace pas la règle
officielle de Skyjo : l'app est une feuille de score, elle ne gère ni la pioche,
ni la défausse, ni le tour de jeu.

Tout ce qui suit (règle du doublement, détection de fin de partie) est
appliqué **côté serveur**, dans `backend/routers/games.py` (`submit_round()`)
— c'est la source de vérité, le frontend affiche ce que le backend renvoie et
ne recalcule rien lui-même. Le calcul du score d'une manche (somme de la
grille, Étoile, colonne/ligne défaussée) reste côté frontend
(`frontend/js/domain.js`), puisqu'il ne produit qu'un entier envoyé ensuite au
backend.

## Score d'une manche

Le score d'un joueur pour une manche est la **somme des valeurs de ses cartes**
restantes.

- Chaque carte compte sa valeur faciale, de −2 à 12.
- La carte Étoile compte **0**.
- Les cases retirées (colonne ou ligne défaussée) ne comptent pas.
- Un score de manche peut être négatif.

La calculatrice 3×4 fait cette somme automatiquement ; la saisie manuelle
permet d'entrer un total déjà compté à la main.

## Colonne et ligne défaussées

En cours de partie, une colonne de 3 cartes identiques ou une ligne de 4 cartes
identiques est défaussée : ces cartes ne comptent plus.

Dans l'app, on le marque depuis n'importe quelle case de la colonne ou de la
ligne concernée (bouton « Colonne » / « Ligne » dans la modale de valeur). Les
3 ou 4 cases passent ensemble à l'état retiré, en pointillés et grisées. Le
même bouton (« Rétablir ») annule l'opération.

> Note : la variante « ligne » n'existe pas dans toutes les éditions de Skyjo.
> Elle est proposée ici parce que le groupe qui utilise cette feuille y joue.
> Si tu joues sans, ignore simplement le bouton.

## Celui qui termine la manche

À la fin de chaque manche, l'app demande **qui a retourné toutes ses cartes en
premier** — c'est lui qui a déclenché la fin de manche.

La règle appliquée :

> Si le score du joueur qui a terminé la manche n'est **pas strictement le plus
> bas** de la manche, son score est **doublé**.

En code (`backend/routers/games.py`, `submit_round()`) :

```python
is_strictly_lowest = all(
    pid == closer_id or scores[pid] > closer_score for pid in player_ids
)
closer_doubled = not is_strictly_lowest
if closer_doubled:
    scores[closer_id] = closer_score * 2
```

Trois conséquences à connaître :

- **L'égalité ne protège pas.** Si le closer fait 12 et qu'un autre joueur fait
  aussi 12, le closer est doublé — « strictement le plus bas » est strict.
- **Un score négatif est doublé aussi**, donc amélioré. Le closer qui termine à
  −4 sans être le plus bas passe à −8. C'est ce que dit la règle littérale ; si
  ta table joue « le doublement ne s'applique qu'aux scores positifs », l'app ne
  le fait pas.
- Le doublement est appliqué **une fois, à la validation**. Le score d'origine
  n'est pas conservé ; l'historique affiche le score doublé suivi de `×2`.

## Fin de partie

La partie se termine dès qu'**un joueur atteint 100 points cumulés**
(`target_score = 100`, comparaison `>=`, vérifiée dans `serialize_game()` côté
backend). La manche en cours est terminée normalement : c'est le total après
validation qui déclenche la fin, et le backend marque alors la partie
`finished`.

Le **score le plus bas gagne**. Le classement (`sortedPlayers`) trie par total
croissant. En cas d'égalité en tête, l'ordre affiché suit l'ordre des joueurs —
l'app ne départage pas les ex æquo.

À la fin, deux sorties :

- **Revanche** — mêmes joueurs, scores remis à zéro, on repart en jeu.
- **Nouvelle partie** — retour au setup, les noms sont conservés.

## Ce que l'app ne fait pas

- Elle ne vérifie pas la cohérence d'un score avec le nombre de cartes saisies.
  Une grille partiellement remplie donne un total partiel, sans avertissement.
- Elle ne connaît pas la composition réelle du paquet : rien n'empêche de saisir
  cinq fois la carte 12 pour un même joueur.
- Elle ne gère pas le tour de jeu, la pioche, ni le retournement des cartes.
- Elle ne rejoue pas une manche déjà validée : il n'y a pas d'annulation.
