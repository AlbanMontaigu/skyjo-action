# Développement

## Lancer

Aucune installation, aucune étape de build.

```bash
# le plus simple
open index.html          # macOS
start index.html         # Windows

# avec un serveur local (recommandé pour tester la photo sur mobile)
python -m http.server 8000
```

Un serveur local est préférable dès qu'on veut tester depuis un téléphone sur le
même réseau, ou vérifier un comportement lié à l'origine (`localStorage`, CORS).

## Modifier

Tout est dans `index.html`. Édite, sauvegarde, recharge — Babel retranspile à
chaque chargement, il n'y a rien à reconstruire.

### Contraintes à respecter

Elles sont volontaires ; les enfreindre casse la propriété centrale du projet
(un fichier qui marche par double-clic). Détail dans [CLAUDE.md](../CLAUDE.md).

- **Un seul fichier.** Pas de modules, pas de bundler, pas de `package.json`.
- **Aucune dépendance npm.** Les icônes sont du SVG inline maison, en
  remplacement de `lucide-react`. Ajoute les nouvelles au même endroit, sur le
  même patron `Icon`.
- **Styles inline** via l'objet `styles`. Le `<style>` du `<head>` est réservé à
  ce que l'inline ne sait pas faire.
- **Texte visible en français, code en anglais.**

### Ajouter une icône

```jsx
const MyIcon = (p) => <Icon {...p}><path d="…" /></Icon>;
```

Le composant `Icon` fixe déjà `viewBox`, `stroke`, `strokeWidth` et les jointures
(convention Lucide, 24×24) : il n'y a que le tracé à fournir.

### Ajouter une modale

Reprends le patron décrit dans [ui-design.md](ui-design.md) : un state
`showX` (ou `xFor: playerId | null`) dans `SkyjoScorer`, un rendu conditionnel
en frère à la fin de l'arbre, et le couple `modalOverlay` / `modalCard`.

Pense à réinitialiser le nouveau state dans `openRoundForm()`, qui remet à zéro
tous les panneaux entre deux manches.

### Toucher aux scores

Relis d'abord [game-rules.md](game-rules.md) et la note sur les `setState`
fonctionnels dans [architecture.md](architecture.md). C'est là que les
régressions silencieuses se logent.

## Tester

Il n'y a pas de tests automatisés. Le fichier n'exporte rien et s'auto-monte au
chargement, ce qui rend un harnais de test non trivial pour le bénéfice attendu.

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
- [ ] Grille : retirer une colonne → 3 cases en pointillés, compteur
      `n/9 (3 retirées)`, total inchangé.
- [ ] Retirer puis rétablir revient à l'état vide.
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

**Photo** (nécessite une clé API)
- [ ] Sans clé → invite + ouverture des réglages, aucun appel réseau.
- [ ] Clé invalide → message dédié « clé invalide ou refusée ».
- [ ] Photo lisible → modale de revue, grille et total cohérents.
- [ ] « Corriger » ouvre la calculatrice sur le bon joueur.
- [ ] Fermer la revue d'un clic à côté conserve le score.
- [ ] Lancer une photo pour un joueur, modifier la grille d'un **autre** joueur
      pendant le chargement : aucune des deux saisies ne doit être perdue.

Ce dernier point est le test de non-régression du patron `setState` fonctionnel.

### Débogage

Pas de source maps : Babel transpile en mémoire, les numéros de ligne des
erreurs ne correspondent pas exactement au fichier. Une erreur de syntaxe JSX se
manifeste par une **page blanche** et un message dans la console — c'est presque
toujours là qu'il faut regarder en premier.

## Déployer

`index.html` est un fichier statique : n'importe quel hébergeur convient.

```bash
# GitHub Pages : activer Pages sur la branche main, racine du dépôt
# la page est alors servie à https://<user>.github.io/skyjo-action/
```

Ne commite jamais une clé API dans le fichier. Elle se saisit dans l'interface et
reste dans le `localStorage` de chaque utilisateur — voir
[photo-scoring.md](photo-scoring.md).

## Pistes

Non implémenté à ce jour, par ordre d'utilité perçue :

- **Persister la partie en cours** dans `localStorage` — un rechargement perd
  tout, c'est la limite la plus gênante à l'usage.
- **Annuler la dernière manche** — `rounds` est append-only, une faute de frappe
  validée oblige à recommencer.
- **Service worker** pour un vrai fonctionnement hors ligne (les CDN sont
  aujourd'hui indispensables au chargement).
- **Fermeture des modales à `Échap`** et piégeage du focus.
