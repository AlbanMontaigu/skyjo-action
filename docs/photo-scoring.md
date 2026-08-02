# Lecture d'une grille par photo

La fonction 📷 envoie une photo de la grille d'un joueur à l'API Anthropic et
remplit la grille 3×4 avec les cartes reconnues. C'est la seule partie de
l'application qui sort du navigateur.

## Parcours utilisateur

```
📷 sur la ligne d'un joueur
   → PhotoSourceModal      « Photo » (appareil) ou « Galerie » (fichier)
   → spinner sur la ligne  photoLoading[playerId]
   → appel API
   → PhotoReviewModal      grille détectée + total, à vérifier
        ├─ « Correct »  → la modale se ferme, le score est déjà dans draft
        └─ « Corriger » → ouvre la calculatrice sur ce joueur pour retoucher
```

Point important : **la grille est appliquée dès que la réponse arrive**, avant
la validation. La modale de revue ne décide que du sort de l'éditeur, pas de
celui des données. Si l'utilisateur ferme la modale d'un clic à côté, le score
reste — il n'a rien perdu.

Le double bouton « Photo » / « Galerie » existe parce que `capture="environment"`
échoue silencieusement sur certains navigateurs quand la permission caméra est
refusée ; « Galerie » est la porte de sortie.

## Appel API

```
POST https://api.anthropic.com/v1/messages
  x-api-key: <clé de l'utilisateur>
  anthropic-version: 2023-06-01
  anthropic-dangerous-direct-browser-access: true

  model: claude-sonnet-4-6
  max_tokens: 700
  temperature: 0
  messages: [{ role: "user", content: [ image (base64), VISION_PROMPT ] }]
```

`temperature: 0` parce qu'on veut une lecture reproductible, pas de la variété.
L'en-tête `anthropic-dangerous-direct-browser-access` est ce qui autorise
l'appel CORS depuis une page ; sans lui, l'API refuse les requêtes navigateur.

L'image est convertie en base64 via `FileReader.readAsDataURL`, en gardant le
`file.type` d'origine comme `media_type` (défaut `image/jpeg`).

## Le prompt

`VISION_PROMPT` est en français et fait une centaine de lignes. Sa structure :

1. **Ce que tu vois** — une grille d'au plus 3×4, certaines cartes face cachée,
   certaines positions défaussées.
2. **Valeurs possibles** — entiers de −2 à 12, rien d'autre n'existe.
3. **Le cas du zéro** — la carte 0 bleue *versus* la carte Étoile multicolore.
4. **La couleur de fond donne la valeur** — le cœur du prompt.
5. **Pièges fréquents** — chaque confusion classique, tranchée par la couleur.
6. **Format de réponse** — JSON strict, positions fixes.

### Le signal qui fait tout marcher

Sur un jeu de Skyjo, la couleur de fond d'une carte encode sa tranche de valeur :

| Couleur | Valeurs |
| --- | --- |
| Bleu foncé | −2, −1 |
| Bleu clair / cyan | 0 |
| Multicolore | Étoile (`"s"`) |
| Vert | 1 à 4 |
| Jaune | 5 à 8 |
| Rouge | 9 à 12 |

C'est une redondance gratuite qui résout presque toutes les ambiguïtés de
lecture d'un chiffre photographié de biais : un « 6 » sur fond rouge est
impossible, c'est donc un 9 ; un « 1 » sur fond jaune est un 7 ; un « 2 » sur
fond rouge est un 12. Le prompt le dit explicitement — *si le chiffre que tu
crois lire est incompatible avec la couleur, c'est ta lecture du chiffre qui est
fausse*.

C'est aussi la raison d'être de la section « pièges » : 6/9, 1/7, 2/12, −1/1,
11/1, 0/8, Étoile/0. Chacun est listé avec la couleur qui le tranche.

### Format de réponse demandé

```json
{"rows":[[3,-1,"x",7],[0,"s","x",8],[2,null,"x",-2]]}
```

Toujours **exactement 3 lignes de 4 cases**, jamais raccourcies, jamais sautées.
C'est ce qui garantit que la position dans le tableau correspond à la position
réelle sur la table. Par case :

- un nombre — carte face visible ;
- `null` — carte face cachée ou illisible (ne jamais inventer) ;
- `"s"` — carte Étoile ;
- `"x"` — position défaussée.

## Parsing de la réponse

Le code ne fait pas confiance au modèle pour renvoyer du JSON nu, ni à lui-même
pour avoir tout prévu. Trois couches de tolérance :

1. **Nettoyage** — les clôtures markdown (` ```json `) sont retirées.
2. **Extraction** — `JSON.parse` direct, et en cas d'échec, extraction de la
   sous-chaîne entre le premier `{` et le dernier `}` (puis `[`…`]`). Une phrase
   parasite avant ou après le JSON ne doit pas coûter sa photo à l'utilisateur.
3. **Normalisation par case** — `cell(v)` accepte `"x"`, et pour l'Étoile
   `"s"`, `"★"`, `"*"`, `"star"`, `"etoile"`, `"étoile"`. Tout nombre hors de
   `[-2, 12]` devient `null` plutôt que d'entrer une valeur impossible.

Les deux formes `{rows: [[…]]}` et tableau plat de 12 sont acceptées. Si aucune
case exploitable n'est trouvée, l'erreur remonte comme une lecture ratée.

## Erreurs

Deux messages seulement, affichés sous la ligne du joueur concerné :

| Cas | Message |
| --- | --- |
| 401 / clé refusée | « Clé API invalide ou refusée. Vérifie-la dans les réglages (🔑). » |
| Tout le reste | « Photo illisible, réessaie avec plus de lumière ou complète à la main. » |

Sans clé enregistrée, le 📷 n'appelle rien : il affiche une invite et ouvre
directement les réglages.

Le second message est volontairement large. Réseau coupé, JSON illisible, photo
floue : dans tous les cas l'action utile est la même — refaire la photo ou
saisir à la main.

## Clé API et sécurité

La clé est saisie dans la modale 🔑 et stockée dans `localStorage` sous
`skyjo_action_anthropic_api_key`. Elle n'est envoyée qu'à `api.anthropic.com`.
Les accès à `localStorage` sont enveloppés dans des `try/catch` : en navigation
privée sur certains navigateurs, l'écriture lève une exception, et l'app doit
continuer à fonctionner sans clé.

Ce que ce choix implique, en clair :

- La clé est **en clair dans le navigateur**. N'importe quel script exécuté sur
  cette origine peut la lire. C'est acceptable pour une page statique que tu
  contrôles, ouverte sur ton propre téléphone.
- **Ne déploie pas cette page avec ta clé pré-remplie**, et n'utilise pas une
  clé partagée : chaque personne saisit la sienne.
- L'usage est **facturé par Anthropic** à qui possède la clé. Une clé dédiée,
  avec une limite de dépense, est le bon réflexe.
- Passer par un proxy serveur supprimerait ce problème — mais ferait aussi
  disparaître la propriété qui fait tout l'intérêt du projet : un fichier HTML
  qui marche par double-clic. Le compromis est assumé.

Sans clé, la photo est la seule fonction indisponible ; la calculatrice et la
saisie manuelle couvrent tout le reste.
