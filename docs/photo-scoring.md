# Lecture d'une grille par photo

La fonction 📷 envoie une photo de la grille d'un joueur à l'API Anthropic et
remplit la grille 3×4 avec les cartes reconnues (chiffres et Étoile). C'est la
seule partie de l'application qui parle à un service externe. Le code vit dans
`backend/routers/vision.py` -- l'appel se fait **côté serveur**, avec la clé
stockée dans la table `settings` ; le navigateur ne voit ni la clé, ni l'appel
réseau vers `api.anthropic.com`.

## Parcours utilisateur

```
📷 sur la ligne d'un joueur
   → PhotoSourceModal      « Photo » (appareil) ou « Galerie » (fichier)
   → spinner sur la ligne  state.photoLoading[playerId]
   → POST /api/vision/read-grid  (multipart, l'image en pièce jointe)
   → PhotoReviewModal      grille détectée + total, à vérifier
        ├─ « Correct »  → la modale se ferme, le score est déjà dans draft
        └─ « Corriger » → ouvre la calculatrice sur ce joueur pour retoucher
```

Point important, inchangé par rapport à l'ancienne version : **la grille est
appliquée dès que la réponse arrive**, avant la validation. La modale de revue
ne décide que du sort de l'éditeur, pas de celui des données. Si l'utilisateur
ferme la modale d'un clic à côté, le score reste — il n'a rien perdu.

Le double bouton « Photo » / « Galerie » existe parce que `capture="environment"`
échoue silencieusement sur certains navigateurs quand la permission caméra est
refusée ; « Galerie » est la porte de sortie.

## Appel API (`backend/routers/vision.py`)

```
POST https://api.anthropic.com/v1/messages
  x-api-key: <clé lue dans la table `settings`>
  anthropic-version: 2023-06-01

  model: claude-opus-5
  max_tokens: 4000
  output_config:
    effort: "low"
    format: { type: "json_schema", schema: GRID_SCHEMA }
  messages: [{ role: "user", content: [ image (base64), VISION_PROMPT ] }]
```

Trois choses à savoir sur ces paramètres :

- **Pas de `temperature`.** Le paramètre a été retiré sur cette génération de
  modèles : l'envoyer renvoie une erreur 400. Le déterminisme se pilote
  désormais par le prompt et par `effort`.
- **`max_tokens` couvre la réflexion *et* la réponse.** Le raisonnement est
  actif par défaut et consomme le même budget ; une valeur trop basse tronque
  la réponse au milieu. D'où les 4000 jetons pour un JSON d'une ligne.
- **`effort: "low"`** garde la lecture rapide à table. C'est une tâche de
  perception courte, pas un problème de raisonnement.

Contrairement à l'ancienne version (appel direct depuis le navigateur), l'en-tête
`anthropic-dangerous-direct-browser-access` n'est plus nécessaire : ce n'est
plus un appel CORS depuis une page, mais un appel serveur-à-serveur normal via
`httpx`.

Le navigateur envoie l'image en `multipart/form-data` (`FormData`, champ
`image`) ; le backend la relit en bytes, l'encode en base64 et transmet
`image.content_type` comme `media_type` (défaut `image/jpeg`).

## Sortie structurée

`GRID_SCHEMA` est passé dans `output_config.format`. L'API **contraint** la
réponse à ce schéma : elle est toujours du JSON valide, sans balises markdown ni
phrase d'introduction à retirer. Chaque case est un `integer`, `null`, ou l'une
des chaînes `"s"` (Étoile) / `"x"` (position défaussée) — les quatre seules
formes que le schéma autorise :

```json
{"rows":[[3,-1,"x",7],[0,"s","x",8],[2,null,"x",-2]]}
```

Le schéma ne peut pas tout dire, cependant : les bornes numériques
(`minimum`/`maximum`) et les longueurs de tableau (`minItems`) ne font pas
partie du sous-ensemble JSON Schema supporté. Le format 3×4 est donc demandé
dans le prompt, et le code borne ce qui revient (`clamp_cell()` dans
`vision.py`) :

- toute valeur hors de `[-2, 12]` retombe à `null` plutôt que d'entrer une
  valeur impossible ;
- une chaîne reconnue comme variante de l'Étoile (`"s"`, `"★"`, `"*"`,
  `"star"`, `"etoile"`, `"étoile"`, insensible à la casse) devient le sentinel
  `STAR` (`"s"`) ; toute autre chaîne que `"x"` retombe à `null` ;
- seules les 3 premières lignes / 4 premières colonnes sont lues, le reste
  d'une réponse trop longue est ignoré plutôt que de déborder de la grille de
  12 cases.

Ceinture et bretelles : le schéma garantit la *forme*, le code garantit le
*domaine*.

## Le prompt

`VISION_PROMPT` (dans `vision.py`) est en français. Sa structure :

1. **Ce que tu vois** — une grille d'au plus 3×4, certaines cartes face cachée,
   certaines positions défaussées (colonne ou ligne entière).
2. **Valeurs possibles** — entiers de −2 à 12, rien d'autre n'existe.
3. **Le cas du zéro** — la carte 0 bleue *versus* la carte Étoile multicolore,
   qui scorent pareil mais ne se ressemblent pas.
4. **La couleur de fond donne la valeur** — le cœur du prompt.
5. **Pièges fréquents** — chaque confusion classique, tranchée par la couleur,
   Étoile comprise.
6. **Format de réponse** — positions fixes, 3 lignes de 4 cases.

### Le signal qui fait tout marcher

Sur un jeu de Skyjo, la couleur de fond d'une carte encode sa tranche de valeur :

| Couleur | Valeurs |
| --- | --- |
| Bleu foncé | −2, −1 |
| Bleu clair / cyan | 0 |
| Multicolore (arc-en-ciel) | Étoile (`"s"`) |
| Vert | 1 à 4 |
| Jaune | 5 à 8 |
| Rouge | 9 à 12 |

C'est une redondance gratuite qui résout presque toutes les ambiguïtés de
lecture d'un chiffre photographié de biais : un « 6 » sur fond rouge est
impossible, c'est donc un 9 ; un « 1 » sur fond jaune est un 7 ; un « 2 » sur
fond rouge est un 12. Le prompt le dit explicitement — *si le chiffre que tu
crois lire est incompatible avec la couleur, c'est ta lecture du chiffre qui est
fausse*. Le même principe distingue la carte 0 (bleu clair uni) de l'Étoile
(multicolore) : aucune carte chiffrée n'est multicolore, donc dès qu'une carte
présente plusieurs couleurs vives, c'est forcément l'Étoile.

C'est aussi la raison d'être de la section « pièges » : 6/9, 1/7, 2/12, −1/1,
11/1, 0/8, Étoile/0, Étoile/8. Chacun est listé avec la couleur qui le tranche.

## Erreurs

Le backend traduit la réponse d'Anthropic en codes HTTP que le frontend
interprète (`frontend/js/events.js`, `handlePhotoSelected`) :

| Cas | HTTP | Message affiché sous la ligne du joueur |
| --- | --- | --- |
| Pas de clé enregistrée | 400 | le 📷 n'appelle même pas le backend : invite + ouverture directe des réglages |
| Clé refusée par Anthropic (401) | 401 | « Clé API invalide ou refusée. Vérifie-la dans les réglages (🔑). » |
| `stop_reason: "refusal"`, JSON illisible, aucune valeur détectée, etc. | 422 | « Photo illisible, réessaie avec plus de lumière ou complète à la main. » |
| API Anthropic injoignable | 502 | même message générique que ci-dessus |

Le second message générique est volontairement large : réseau coupé, JSON
illisible, photo floue, refus de sécurité (`stop_reason: "refusal"`, qui arrive
en HTTP 200 côté Anthropic avec un contenu vide) -- dans tous les cas l'action
utile est la même, refaire la photo ou saisir à la main.

## Clé API et sécurité

La clé est saisie dans la modale 🔑, envoyée en `PUT /api/settings/api-key` et
stockée dans la table SQLite `settings` (`backend/data/skyjo.db`). Elle n'est
plus jamais renvoyée au client — `GET /api/settings` répond seulement
`{"has_api_key": true/false}`, jamais la valeur. Concrètement, rouvrir la modale
🔑 après avoir enregistré une clé montre un champ vide avec un placeholder
(« clé déjà enregistrée »), pas la clé en clair : c'est le prix à payer pour
qu'elle ne transite plus jamais côté navigateur.

Ce que ce choix implique, en clair :

- La clé est **en clair sur disque**, dans `backend/data/skyjo.db` (ignoré par
  git). Elle n'est en revanche plus jamais exposée au navigateur ni à un script
  qui s'exécuterait sur la page -- une amélioration nette par rapport à
  l'ancien `localStorage`.
- **Ne commite jamais** `backend/data/`, et n'utilise pas une clé partagée entre
  plusieurs foyers si tu déploies cette app pour plusieurs personnes : il n'y a
  qu'une seule clé pour toute l'instance.
- L'usage est **facturé par Anthropic** à qui possède la clé. Une clé dédiée,
  avec une limite de dépense, est le bon réflexe.

Sans clé, la photo est la seule fonction indisponible ; la calculatrice et la
saisie manuelle couvrent tout le reste.
