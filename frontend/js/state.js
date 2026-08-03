// Central app state + render dispatcher.
//
// There is no virtual DOM here: render() rebuilds #app's innerHTML from
// `state` on every *structural* change (phase switch, modal open/close,
// player add/remove, round submitted) -- the same "recompute everything from
// state" model the old React version used, just without JSX or a diffing
// library.
//
// Text/number inputs are the one exception: they update `state` directly on
// `input` (see events.js) WITHOUT calling render(), which is what preserves
// cursor position/focus while typing, since the DOM node is never touched.
// The next structural render then reflects the latest typed value, because
// every render function reads straight from `state`.
import { playerColor, uid } from "./domain.js";
import { renderHeader } from "./views/header.js";
import { renderSetupPhase } from "./views/setup.js";
import { renderPlayingPhase } from "./views/playing.js";
import {
  renderCloserModal,
  renderCardValueModal,
  renderPhotoSourceModal,
  renderPhotoReviewModal,
  renderRankingModal,
  renderHistoryModal,
  renderConfirmNewGameModal,
  renderSettingsModal,
  renderNamePickerModal,
} from "./modals.js";

export const state = {
  booted: false,

  // ---- game state (mirrors the old `phase`/`players`/`rounds`) ----
  phase: "setup", // "setup" | "playing"
  gameId: null,
  players: [], // [{id: game_player_id, name, position}], server-assigned ids
  rounds: [], // [{round_number, closer_game_player_id, closer_doubled, scores}]
  totals: {}, // {game_player_id: number}, from the backend
  targetScore: 100,
  gameOver: false,

  // setup-phase player rows, before a game exists server-side. Local-only
  // ids (uid()) since these aren't game_player_id yet.
  setupPlayers: [{ id: uid(), name: "" }, { id: uid(), name: "" }],

  knownPlayers: [], // roster names from the backend, for the name picker
  hasApiKey: false,

  // ---- round-in-progress state ----
  draft: {}, // {game_player_id: string} -- scores being entered this round
  pendingScores: null, // {game_player_id: number} | null, validated, awaiting closer pick
  error: "",
  setupError: "", // network/validation error creating a game, shown on the setup screen

  // ---- calculator / grid state ----
  calcOpenId: null, // game_player_id | null
  calcCards: {}, // {game_player_id: Cell[12]}
  cellModal: null, // {playerId, idx} | null
  manualOpenId: null, // game_player_id | null

  // ---- modals ----
  showCloserModal: false,
  showRanking: false,
  showHistory: false,
  showSettings: false,
  confirmNewGame: false,
  photoSourceFor: null, // game_player_id | null
  photoReviewFor: null, // game_player_id | null
  photoLoading: {}, // {game_player_id: bool}
  photoError: {}, // {game_player_id: string}

  pickerFor: null, // setup-phase name picker: local player id | null
  pickerCustomName: "",

  settingsValue: "",
  settingsVisible: false,
};

// The player list currently on screen: setup rows before a game exists,
// server-assigned players once one does.
export function currentPlayers() {
  return state.phase === "setup" ? state.setupPlayers : state.players;
}

export function colorFor(playerId) {
  const i = currentPlayers().findIndex((p) => p.id === playerId);
  return playerColor(i < 0 ? 0 : i);
}

export function sortedPlayers() {
  return [...state.players].sort((a, b) => (state.totals[a.id] ?? 0) - (state.totals[b.id] ?? 0));
}

export function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page"><div class="wrap">
      ${renderHeader()}
      ${state.phase === "setup" ? renderSetupPhase() : ""}
      ${state.phase === "playing" ? renderPlayingPhase() : ""}
      ${state.showCloserModal ? renderCloserModal() : ""}
      ${state.cellModal ? renderCardValueModal() : ""}
      ${state.photoSourceFor ? renderPhotoSourceModal() : ""}
      ${state.photoReviewFor ? renderPhotoReviewModal() : ""}
      ${state.showRanking ? renderRankingModal() : ""}
      ${state.showHistory ? renderHistoryModal() : ""}
      ${state.confirmNewGame ? renderConfirmNewGameModal() : ""}
      ${state.showSettings ? renderSettingsModal() : ""}
      ${state.pickerFor ? renderNamePickerModal() : ""}
    </div></div>
  `;
}
