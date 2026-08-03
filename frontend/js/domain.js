// Skyjo Action domain helpers -- ported 1:1 from the old index.html.

// The Star card is a joker worth 0, but it is a physically different card
// from the light-blue "0": on the real deck it has a rainbow background and
// a star, no digit. Keeping it distinct means the on-screen grid actually
// matches what the player laid out on the table.
export const STAR = "s";

// The whole Skyjo Action deck: integers from -2 to 12, plus the Star card.
export const CARD_VALUES = [-2, -1, 0, STAR, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const STAR_BG =
  "linear-gradient(135deg,#c23b3b 0%,#e0ab1f 22%,#2f8f4f 45%,#1f8fa3 66%,#3a4fb5 85%,#8e44ad 100%)";

// Background colour by value band -- the same colour code as the real cards.
export function band(v) {
  if (v === STAR) return { bg: STAR_BG, fg: "#ffffff" };
  if (v <= -1) return { bg: "#1b3a6b", fg: "#dbe7ff" };
  if (v === 0) return { bg: "#1f8fa3", fg: "#e6fbff" };
  if (v <= 4) return { bg: "#2f8f4f", fg: "#eafff0" };
  if (v <= 8) return { bg: "#e0ab1f", fg: "#3a2900" };
  return { bg: "#c23b3b", fg: "#fff0ee" };
}

export const MAX_PLAYERS = 8;
export const TARGET = 100;

// One colour per player, used consistently everywhere a name appears (avatar,
// score row, history columns, ranking) so it's obvious at a glance which
// score belongs to whom. Deliberately a different palette from `band()`
// (which colours a CARD by its value) to avoid mixing up the two meanings.
export const PLAYER_COLORS = [
  "#4fc3f7", "#f06292", "#aed581", "#ffb74d",
  "#ba68c8", "#4db6ac", "#ff8a65", "#dce775",
];
export const playerColor = (i) => PLAYER_COLORS[i % PLAYER_COLORS.length];

// Default names for the first players, so the usual pair doesn't have to be
// retyped every game. Beyond these, fall back to "Joueur N".
const DEFAULT_NAMES = ["Chaton", "Minou"];
export const defaultName = (i) => DEFAULT_NAMES[i] || `Joueur ${i + 1}`;

// Sentinel for "this position doesn't exist anymore" -- a full column (3
// cards) or full row (4 cards) of identical values gets discarded during
// play. Distinct from null, which means "still a card here, just not
// entered yet".
export const REMOVED = "x";

// A cell holds: a number (-2..12), STAR (a card worth 0), REMOVED (position
// gone), or null (empty).
export const isCard = (v) => typeof v === "number" || v === STAR;
export const cardValue = (v) => (typeof v === "number" ? v : 0);

export const uid = () => Math.random().toString(36).slice(2, 9);

export const gridSum = (grid) => (grid || []).reduce((a, b) => a + (isCard(b) ? cardValue(b) : 0), 0);
