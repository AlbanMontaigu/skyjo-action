// Event delegation + all handlers -- the business-logic glue that used to
// live in SkyjoScorer's handlers. Two delegated listeners are bound once on
// #app in bindEvents() (called by app.js after the first render) and survive
// every innerHTML rebuild:
//
//  - click/change, dispatched by `data-action` to the `handlers` map below.
//  - input, which writes straight into `state` for text/number fields
//    WITHOUT calling render() -- see state.js's comment on why.
//
// Player ids from `state.players` (the backend's game_player_id) are always
// numbers; setup-phase ids (state.setupPlayers) are always the local uid()
// strings. `dataset.*` values are always strings, so handlers that act on
// backend players convert with Number() -- otherwise `state.calcOpenId ===
// p.id` and friends would silently never match.
import { state, render } from "./state.js";
import * as api from "./api.js";
import { MAX_PLAYERS, REMOVED, STAR, uid, gridSum, defaultName } from "./domain.js";
import { errorMessage } from "./util.js";

function ensureCalcGrid(playerId) {
  if (!state.calcCards[playerId]) state.calcCards[playerId] = Array(12).fill(null);
}

function syncDraft(playerId, grid) {
  const filled = grid.some((v) => v !== null);
  state.draft[playerId] = filled ? String(gridSum(grid)) : "";
}

function applyGameState(game) {
  state.gameId = game.id;
  state.players = game.players;
  state.rounds = game.rounds;
  state.totals = game.totals;
  state.targetScore = game.target_score;
  state.gameOver = game.game_over;
}

// Resets draft + every panel/error between rounds -- mirrors the old
// openRoundForm(), which reset all of this in one place so nothing leaks
// from one round's UI state into the next.
function resetRoundForm() {
  const d = {};
  state.players.forEach((p) => (d[p.id] = ""));
  state.draft = d;
  state.showCloserModal = false;
  state.pendingScores = null;
  state.error = "";
  state.calcOpenId = null;
  state.calcCards = {};
  state.cellModal = null;
  state.manualOpenId = null;
  state.photoSourceFor = null;
  state.photoReviewFor = null;
  state.photoError = {};
  state.photoLoading = {};
}

async function doNewGame() {
  let endGameFailed = false;
  if (state.gameId) {
    try {
      await api.endGame(state.gameId);
    } catch (e) {
      // Not fatal: create_game defensively closes any orphaned "playing"
      // game itself (see games.py), so this can't corrupt the next game --
      // but the player should still know why, rather than the failure
      // disappearing into the console.
      console.error(e);
      endGameFailed = true;
    }
  }
  state.phase = "setup";
  // Keep the names around like the old newGame() did, so a "start again"
  // doesn't force retyping everyone.
  state.setupPlayers = state.players.length
    ? state.players.map((p) => ({ id: uid(), name: p.name }))
    : state.setupPlayers;
  state.gameId = null;
  state.rounds = [];
  state.totals = {};
  state.gameOver = false;
  state.showRanking = false;
  state.confirmNewGame = false;
  state.showHistory = false;
  state.setupError = endGameFailed
    ? "L'ancienne partie n'a pas pu être clôturée côté serveur (ce sera fait automatiquement au prochain lancement)."
    : "";
  render();
}

async function startGame() {
  const names = state.setupPlayers.map((p, i) => p.name.trim() || defaultName(i));
  try {
    const game = await api.createGame(names);
    applyGameState(game);
    state.phase = "playing";
    resetRoundForm();
    state.setupError = "";
  } catch (e) {
    state.setupError = errorMessage(e, "Impossible de créer la partie.");
  }
  render();
}

async function finalizeRound(closerId) {
  try {
    const game = await api.submitRound(state.gameId, state.pendingScores, closerId);
    applyGameState(game);
    resetRoundForm();
    if (state.gameOver) state.showRanking = true;
  } catch (e) {
    state.error = errorMessage(e, "Impossible d'enregistrer la manche.");
    state.showCloserModal = false;
  }
  render();
}

async function rematch() {
  try {
    const game = await api.rematchGame(state.gameId);
    applyGameState(game);
    state.phase = "playing";
    resetRoundForm();
    state.showRanking = false;
    state.rematchError = "";
  } catch (e) {
    console.error(e);
    state.rematchError = errorMessage(e, "Impossible de démarrer la revanche, réessaie.");
  }
  render();
}

// Step 1: validate every player's score is a real number, then open the
// "who finished the round" modal. Step 2 (finalizeRound) applies the
// doubling rule server-side once a closer is actually picked.
function openCloserModal() {
  const scores = {};
  for (const p of state.players) {
    const raw = state.draft[p.id];
    if (raw === "" || raw === undefined || isNaN(Number(raw))) {
      state.error = `Score manquant pour ${p.name}`;
      render();
      return;
    }
    scores[p.id] = Number(raw);
  }
  state.error = "";
  state.pendingScores = scores;
  state.showCloserModal = true;
  render();
}

async function handlePhotoSelected(file, playerId) {
  if (!file || !playerId) return;
  if (!state.hasApiKey) {
    state.photoError[playerId] = "Ajoute ta clé API Anthropic (icône 🔑 en haut) pour utiliser la photo.";
    state.showSettings = true;
    render();
    return;
  }
  state.photoError[playerId] = "";
  state.photoLoading[playerId] = true;
  render();
  try {
    const { grid } = await api.readGridFromPhoto(file);
    state.calcCards[playerId] = grid;
    syncDraft(playerId, grid);
    state.photoReviewFor = playerId;
  } catch (err) {
    // The backend already differentiates key/network/model-side failures
    // with a specific French `detail` (see vision.py) -- only 401 needs a
    // more actionable message here, pointing at the settings icon.
    state.photoError[playerId] =
      err.status === 401
        ? "Clé API invalide ou refusée. Vérifie-la dans les réglages (🔑)."
        : errorMessage(err, "Photo illisible, réessaie avec plus de lumière ou complète à la main.");
  } finally {
    state.photoLoading[playerId] = false;
    render();
  }
}

const CLOSE_MODAL_FIELD = {
  closer: "showCloserModal",
  cell: "cellModal",
  photoSource: "photoSourceFor",
  ranking: "showRanking",
  history: "showHistory",
  confirmNewGame: "confirmNewGame",
  settings: "showSettings",
  picker: "pickerFor",
};
const NULLABLE_MODAL_FIELDS = new Set(["cellModal", "photoSourceFor", "pickerFor"]);

function closeModal(name) {
  const field = CLOSE_MODAL_FIELD[name];
  if (!field) return;
  state[field] = NULLABLE_MODAL_FIELDS.has(field) ? null : false;
  render();
}

const handlers = {
  "open-ranking": () => {
    state.showRanking = true;
    state.rematchError = "";
    render();
  },
  "open-settings": () => {
    state.showSettings = true;
    state.settingsValue = "";
    state.settingsVisible = false;
    state.settingsError = "";
    render();
  },
  "request-new-game": () => {
    if (state.rounds.length > 0) {
      state.confirmNewGame = true;
      render();
    } else {
      doNewGame();
    }
  },
  "open-history": () => {
    state.showHistory = true;
    render();
  },
  "add-player": () => {
    if (state.setupPlayers.length < MAX_PLAYERS) state.setupPlayers.push({ id: uid(), name: "" });
    render();
  },
  "remove-player": (ds) => {
    if (state.setupPlayers.length > 2) {
      state.setupPlayers = state.setupPlayers.filter((p) => p.id !== ds.playerId);
    }
    render();
  },
  "open-picker": (ds) => {
    const editing = state.setupPlayers.find((p) => p.id === ds.playerId);
    if (!editing) return;
    state.pickerFor = ds.playerId;
    state.pickerCustomName = editing.name;
    render();
  },
  "start-game": () => startGame(),
  "open-photo-source": (ds) => {
    state.photoSourceFor = Number(ds.playerId);
    render();
  },
  "toggle-calc": (ds) => {
    const id = Number(ds.playerId);
    state.calcOpenId = state.calcOpenId === id ? null : id;
    ensureCalcGrid(id);
    render();
  },
  "toggle-manual": (ds) => {
    const id = Number(ds.playerId);
    state.manualOpenId = state.manualOpenId === id ? null : id;
    render();
  },
  "open-cell-modal": (ds) => {
    const id = Number(ds.playerId);
    ensureCalcGrid(id);
    state.cellModal = { playerId: id, idx: Number(ds.idx) };
    render();
  },
  "clear-calc": (ds) => {
    const id = Number(ds.playerId);
    state.calcCards[id] = Array(12).fill(null);
    state.draft[id] = "";
    render();
  },
  "open-closer-modal": () => openCloserModal(),
  "pick-closer": (ds) => finalizeRound(Number(ds.playerId)),
  "pick-cell-value": (ds) => {
    if (!state.cellModal) return;
    const { playerId, idx } = state.cellModal;
    const grid = [...(state.calcCards[playerId] || Array(12).fill(null))];
    // Every CARD_VALUES entry is either STAR ("s") or a number -- keep the
    // string as-is instead of Number()-coercing it into NaN.
    grid[idx] = ds.value === STAR ? STAR : Number(ds.value);
    state.calcCards[playerId] = grid;
    syncDraft(playerId, grid);
    state.cellModal = null;
    render();
  },
  "delete-cell-value": () => {
    if (!state.cellModal) return;
    const { playerId, idx } = state.cellModal;
    const grid = [...(state.calcCards[playerId] || Array(12).fill(null))];
    grid[idx] = null;
    state.calcCards[playerId] = grid;
    syncDraft(playerId, grid);
    state.cellModal = null;
    render();
  },
  // A full column (3 cards) or full row (4 cards) of identical values gets
  // discarded together in Skyjo Action -- so removal toggles the whole
  // column/row at once, never a single cell.
  "toggle-column": () => {
    if (!state.cellModal) return;
    const { playerId, idx } = state.cellModal;
    const col = idx % 4;
    const indices = [col, col + 4, col + 8];
    const grid = [...(state.calcCards[playerId] || Array(12).fill(null))];
    const alreadyRemoved = indices.every((i) => grid[i] === REMOVED);
    indices.forEach((i) => {
      grid[i] = alreadyRemoved ? null : REMOVED;
    });
    state.calcCards[playerId] = grid;
    syncDraft(playerId, grid);
    state.cellModal = null;
    render();
  },
  "toggle-row": () => {
    if (!state.cellModal) return;
    const { playerId, idx } = state.cellModal;
    const row = Math.floor(idx / 4);
    const indices = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
    const grid = [...(state.calcCards[playerId] || Array(12).fill(null))];
    const alreadyRemoved = indices.every((i) => grid[i] === REMOVED);
    indices.forEach((i) => {
      grid[i] = alreadyRemoved ? null : REMOVED;
    });
    state.calcCards[playerId] = grid;
    syncDraft(playerId, grid);
    state.cellModal = null;
    render();
  },
  "close-modal": (ds) => closeModal(ds.modal),
  "confirm-new-game": () => doNewGame(),
  "new-game": () => doNewGame(),
  rematch: () => rematch(),
  "confirm-photo-review": () => {
    state.photoReviewFor = null;
    render();
  },
  // The grid is applied as soon as the photo resolves (handlePhotoSelected);
  // this modal only decides what happens to the EDITOR: confirm keeps it
  // collapsed, correct opens it for the user to fix cells.
  "correct-photo-review": () => {
    const pid = state.photoReviewFor;
    state.photoReviewFor = null;
    state.calcOpenId = pid;
    render();
  },
  "pick-name": (ds) => {
    const editing = state.setupPlayers.find((p) => p.id === state.pickerFor);
    if (editing) editing.name = ds.name;
    state.pickerFor = null;
    render();
  },
  "pick-custom-name": () => {
    const editing = state.setupPlayers.find((p) => p.id === state.pickerFor);
    if (editing) editing.name = state.pickerCustomName.trim();
    state.pickerFor = null;
    render();
  },
  "save-api-key": async () => {
    try {
      const res = await api.saveApiKey(state.settingsValue.trim());
      state.hasApiKey = res.has_api_key;
      // Only close/clear on success -- on failure the modal used to close
      // anyway, silently discarding the typed key and leaving the user
      // thinking it was saved when it wasn't.
      state.showSettings = false;
      state.settingsValue = "";
      state.settingsError = "";
    } catch (e) {
      console.error(e);
      state.settingsError = errorMessage(e, "Impossible d'enregistrer la clé, réessaie.");
    }
    render();
  },
  // Deliberately doesn't close the modal, matching the old SettingsModal:
  // "Retirer" clears the key but leaves the sheet open.
  "remove-api-key": async () => {
    try {
      await api.removeApiKey();
      state.hasApiKey = false;
      state.settingsValue = "";
      state.settingsError = "";
    } catch (e) {
      console.error(e);
      state.settingsError = errorMessage(e, "Impossible de retirer la clé, réessaie.");
    }
    render();
  },
  "toggle-key-visibility": () => {
    state.settingsVisible = !state.settingsVisible;
    render();
  },
  // Used by the boot-error banner and the fatal-error fallback screen (see
  // state.js's renderFatal): simplest reliable recovery is a full reload,
  // which re-runs boot() and re-resumes the game from the backend.
  "reload-page": () => location.reload(),
};

function handleAction(action, dataset) {
  const fn = handlers[action];
  if (fn) fn(dataset);
}

export function bindEvents() {
  const app = document.getElementById("app");

  app.addEventListener("click", (e) => {
    const overlay = e.target.closest("[data-overlay]");
    if (overlay && e.target === overlay) {
      handleAction(overlay.dataset.action, overlay.dataset);
      return;
    }
    // Exclude [data-overlay] here: it's only meant to close on a direct hit
    // (handled above). Without this, a click on a plain child with no
    // data-action of its own (e.g. the settings/picker text inputs) bubbles
    // straight up to the overlay's data-action="close-modal" and closes the
    // modal the instant the user taps the input to focus it.
    const el = e.target.closest("[data-action]:not([data-overlay])");
    if (el) handleAction(el.dataset.action, el.dataset);
  });

  app.addEventListener("change", (e) => {
    const el = e.target.closest('[data-action="photo-selected"]');
    if (!el || !el.files || !el.files[0]) return;
    const file = el.files[0];
    const playerId = state.photoSourceFor;
    state.photoSourceFor = null;
    render();
    handlePhotoSelected(file, playerId);
  });

  // Text/number inputs update state directly, without render() -- see the
  // module comment above and state.js's render() comment for why.
  app.addEventListener("input", (e) => {
    const el = e.target.closest("[data-bind]");
    if (!el) return;
    const field = el.dataset.bind;
    if (field === "draft") {
      state.draft[Number(el.dataset.playerId)] = el.value;
    } else if (field === "pickerCustomName") {
      state.pickerCustomName = el.value;
    } else if (field === "settingsValue") {
      state.settingsValue = el.value;
    }
  });
}
