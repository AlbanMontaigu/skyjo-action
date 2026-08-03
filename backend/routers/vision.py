"""Photo-to-score: reads a Skyjo Action player's 3x4 grid from a photo via
Claude vision. Ported from the old frontend's `handlePhotoSelected` -- see
docs/photo-scoring.md for the full rationale behind the prompt, the model
parameters and the clamping below. The only thing that changed in the move
is *where* this runs: the Anthropic API key now comes from the settings
table instead of the browser, so the call happens here instead of in the
page.
"""

import base64
import json
import logging

import httpx
from fastapi import APIRouter, HTTPException, UploadFile

from .settings import get_api_key

router = APIRouter()
logger = logging.getLogger(__name__)

REMOVED = "x"
STAR = "s"

# The single most useful signal is that a Skyjo card's background colour
# encodes its value band, which resolves nearly every digit ambiguity (a "6"
# on red is impossible, so it is a 9; a "1" on yellow is a 7; etc.) -- and
# for Skyjo Action, the same colour rule is what separates the blue "0" card
# from the multicoloured Star card, which score the same but are physically
# different cards.
VISION_PROMPT = "\n".join(
    [
        "Tu lis la grille de cartes d'un joueur de Skyjo sur cette photo.",
        "",
        "CE QUE TU VOIS",
        "Une grille d'AU PLUS 3 lignes × 4 colonnes (position fixe, même si des cases n'existent plus).",
        "Certaines cartes sont face visible (un chiffre lisible), d'autres face cachée (dos uniforme, sans chiffre).",
        "Une colonne entière (3 cartes, verticale) ou une ligne entière (4 cartes, horizontale) a pu être",
        "défaussée en cours de partie parce que ses cartes étaient identiques : ces cases sont physiquement",
        "vides ou absentes sur la photo, à un emplacement précis de la grille 3×4.",
        "",
        "VALEURS POSSIBLES",
        "Uniquement des entiers de -2 à 12. Rien d'autre n'existe dans ce jeu.",
        "Le chiffre est imprimé en gros et en noir au centre de la carte, à 1 ou 2 chiffres.",
        "Seuls -1 et -2 sont négatifs, reconnaissables au signe moins devant le chiffre.",
        "",
        "LE CAS DU ZÉRO — deux cartes différentes valent 0, et elles ne se ressemblent PAS :",
        "  a) la carte 0 : fond bleu clair uni, avec un « 0 » imprimé bien net au centre. -> réponds 0",
        "  b) la carte Étoile : fond MULTICOLORE (arc-en-ciel, plusieurs couleurs vives sur la même carte),",
        "     avec une grande étoile au centre et AUCUN chiffre. -> réponds la chaîne \"s\"",
        "Le fond multicolore est unique dans le jeu : aucune carte numérotée n'a plusieurs couleurs.",
        "Dès que tu vois une carte multicolore avec une étoile, c'est \"s\" — inutile de chercher un chiffre.",
        "Distingue bien les deux : 0 pour la carte bleue chiffrée, \"s\" pour la carte étoile multicolore.",
        "",
        "LA COULEUR DE FOND DONNE LA VALEUR — utilise-la systématiquement pour vérifier ta lecture :",
        "  bleu foncé  -> -2 ou -1",
        "  bleu clair / cyan -> 0 (chiffre « 0 » imprimé)",
        "  MULTICOLORE -> carte Étoile, à rendre \"s\" (aucune carte chiffrée n'est multicolore)",
        "  vert        -> 1, 2, 3 ou 4",
        "  jaune       -> 5, 6, 7 ou 8",
        "  rouge       -> 9, 10, 11 ou 12",
        "Si le chiffre que tu crois lire est incompatible avec la couleur, c'est ta lecture du chiffre qui est",
        "fausse : corrige-la pour respecter la couleur.",
        "",
        "PIÈGES FRÉQUENTS (la couleur les tranche à chaque fois)",
        "  6 vs 9   : le 6 est jaune, le 9 est rouge.",
        "  1 vs 7   : le 1 est vert, le 7 est jaune.",
        "  2 vs 12  : le 2 est vert, le 12 est rouge.",
        "  -1 vs 1  : le -1 est bleu foncé, le 1 est vert.",
        "  11 vs 1  : le 11 est rouge (2 chiffres), le 1 est vert.",
        "  0 vs 8   : le 0 est bleu clair, le 8 est jaune.",
        "  0 vs 6/9 : le 0 est bleu clair ; le 6 est jaune et le 9 est rouge.",
        "  Étoile vs 0 : l'Étoile est multicolore (rends \"s\"), la carte 0 est bleu clair unie (rends 0).",
        "  Étoile vs 8 : une étoile n'est pas un chiffre ; fond multicolore = \"s\".",
        "Une carte photographiée de biais ou à l'envers reste lisible : fie-toi à la couleur et au signe moins.",
        "",
        "FORMAT DE RÉPONSE — IMPORTANT POUR LA POSITION",
        "Rends la clé \"rows\" : TOUJOURS exactement 3 lignes, chaque ligne étant TOUJOURS exactement 4 cases",
        "dans l'ordre gauche à droite, même si certaines cases n'existent plus.",
        "Ne raccourcis JAMAIS une ligne et ne saute JAMAIS une ligne : la position de chaque valeur dans le",
        "tableau doit correspondre exactement à sa position réelle sur la grille.",
        "Pour chaque case, utilise :",
        "  - un nombre, si une carte face visible est là,",
        "  - null, si une carte face cachée ou illisible est là (n'invente jamais sa valeur),",
        "  - la chaîne \"s\", si c'est une carte Étoile (multicolore, sans chiffre),",
        "  - la chaîne \"x\", si cette case n'existe plus (colonne ou ligne entière déjà défaussée).",
        "",
        "Exemple. Une grille dont la 3e colonne est défaussée, avec une carte face cachée, une carte 0 bleue",
        "en 2e ligne 1re case, et une carte Étoile juste à sa droite, se rend EXACTEMENT comme ceci :",
        '{"rows":[[3,-1,"x",7],[0,"s","x",8],[2,null,"x",-2]]}',
    ]
)

GRID_SCHEMA = {
    "type": "object",
    "properties": {
        "rows": {
            "type": "array",
            "description": "Exactement 3 lignes de 4 cases, de haut en bas.",
            "items": {
                "type": "array",
                "items": {
                    "anyOf": [
                        {"type": "integer", "description": "Carte face visible, -2 à 12"},
                        {"type": "null", "description": "Carte face cachée ou illisible"},
                        {"type": "string", "enum": ["s"], "description": "Carte Étoile (0 points)"},
                        {"type": "string", "enum": ["x"], "description": "Position défaussée"},
                    ]
                },
            },
        }
    },
    "required": ["rows"],
    "additionalProperties": False,
}

STAR_ALIASES = {"s", "★", "*", "star", "etoile", "étoile"}


def clamp_cell(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip().lower()
        if s == "x":
            return REMOVED
        if s in STAR_ALIASES:
            return STAR
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if -2 <= n <= 12 else None


@router.post("/read-grid")
async def read_grid(image: UploadFile):
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(400, "Aucune clé API Anthropic configurée.")

    image_bytes = await image.read()
    b64 = base64.b64encode(image_bytes).decode("ascii")
    media_type = image.content_type or "image/jpeg"

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "content-type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-opus-5",
                    "max_tokens": 4000,
                    "output_config": {
                        "effort": "low",
                        "format": {"type": "json_schema", "schema": GRID_SCHEMA},
                    },
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": b64,
                                    },
                                },
                                {"type": "text", "text": VISION_PROMPT},
                            ],
                        }
                    ],
                },
            )
        except httpx.RequestError as exc:
            logger.warning("Anthropic API unreachable: %s", exc)
            raise HTTPException(502, "Impossible de contacter l'API Anthropic, réessaie dans un instant.") from exc

    if response.status_code == 401:
        raise HTTPException(401, "Clé API invalide ou refusée.")
    if not response.is_success:
        # The raw detail (often English, from Anthropic's own error body) is
        # only useful for us -- log it, but keep the user-facing message
        # French and generic per this app's language convention.
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except ValueError:
            pass
        logger.warning("Anthropic API error %s: %s", response.status_code, detail)
        raise HTTPException(502, "L'API Anthropic a renvoyé une erreur inattendue.")

    data = response.json()
    if data.get("stop_reason") == "refusal":
        logger.info("Anthropic vision refused to analyze the photo")
        raise HTTPException(422, "Le modèle a refusé d'analyser cette photo, réessaie avec une autre.")

    text_block = next((b for b in data.get("content", []) if b.get("type") == "text"), None)
    if text_block is None:
        logger.warning("Vision response had no text content block: stop_reason=%s", data.get("stop_reason"))
        raise HTTPException(422, "Réponse inattendue du service de lecture, réessaie.")

    try:
        parsed = json.loads(text_block["text"])
    except (ValueError, KeyError) as exc:
        logger.warning("Vision response text wasn't valid JSON: %s", exc)
        raise HTTPException(422, "Réponse inattendue du service de lecture, réessaie.") from exc

    rows = parsed.get("rows") if isinstance(parsed, dict) else None
    if not isinstance(rows, list):
        logger.warning("Vision response JSON had no 'rows' list: %r", parsed)
        raise HTTPException(422, "Réponse inattendue du service de lecture, réessaie.")

    grid = [None] * 12
    for r, row in enumerate(rows[:3]):
        if not isinstance(row, list):
            continue
        for c, value in enumerate(row[:4]):
            grid[r * 4 + c] = clamp_cell(value)

    read_count = sum(1 for v in grid if isinstance(v, int) or v == STAR)
    removed_count = sum(1 for v in grid if v == REMOVED)
    if read_count == 0 and removed_count == 0:
        logger.info("Vision read-grid found no usable cells")
        raise HTTPException(422, "Aucune carte reconnue sur la photo, réessaie avec plus de lumière ou complète à la main.")

    return {"grid": grid}
