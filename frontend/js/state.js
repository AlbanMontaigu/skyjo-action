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
import { escapeHtml } from "./util.js";
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
  bootError: "", // set if the initial settings/roster/active-game fetch fails
  buildVersion: "", // human-readable build date/time from /build.txt (Docker builds only)

  // ---- round-in-progress state ----
  draft: {}, // {game_player_id: string} -- scores being entered this round
  pendingScores: null, // {game_player_id: number} | null, validated, awaiting closer pick
  error: "",
  setupError: "", // network/validation error creating a game, shown on the setup screen
  rematchError: "", // network error starting a rematch, shown in the ranking modal
  settingsError: "", // network error saving/removing the API key, shown in the settings modal

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

// Last-resort screen for when render() itself throws (unexpected state
// shape) or an error/rejection escapes every handler uncaught: the normal
// render path is exactly what just failed, so this stays hand-written HTML
// with no dependency on `state`, view modules or render() ever succeeding.
export function renderFatal() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="page"><div class="wrap">
      <div class="section">
        <div class="error-box">
          Une erreur inattendue est survenue. La partie en cours reste sauvegardée --
          recharge la page pour continuer.
        </div>
        <button class="card-btn primary-btn" data-action="reload-page">Recharger</button>
      </div>
    </div></div>
  `;
}

export function render() {
  const app = document.getElementById("app");
  try {
    app.innerHTML = `
      <div class="page"><div class="wrap">
        ${
          state.bootError
            ? `<div class="error-box">${escapeHtml(state.bootError)}
                 <button class="card-btn ghost-btn" style="margin-top:8px" data-action="reload-page">Réessayer</button>
               </div>`
            : ""
        }
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
        ${
          state.buildVersion
            ? `<button type="button" class="build-footer" data-action="force-refresh" title="Forcer le rechargement de la dernière version">${escapeHtml(state.buildVersion)}</button>`
            : ""
        }
      </div></div>
    `;
  } catch (e) {
    console.error("render() failed", e);
    renderFatal();
  }
}
