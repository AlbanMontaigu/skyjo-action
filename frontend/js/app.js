// Boot sequence: bind events once, paint immediately, then load settings /
// the known-player roster / any in-progress game from the backend and
// resume straight into it -- this is what fixes the old app's "a reload
// loses the game" limitation, now that state lives in SQLite instead of
// only in memory.
import { state, render, renderFatal } from "./state.js";
import { bindEvents } from "./events.js";
import * as api from "./api.js";

// frontend/build.txt reads "dev" in the repo; the Dockerfile overwrites it
// with the build date/time at image build time (see Dockerfile). Kept out of
// the Promise.all below and its own try/catch so a network hiccup here never
// sets bootError -- the footer just stays blank.
async function loadBuildVersion() {
  try {
    const res = await fetch("/build.txt", { cache: "no-store" });
    if (res.ok) {
      state.buildVersion = (await res.text()).trim();
      render();
    }
  } catch (e) {
    console.warn("Failed to load build.txt", e);
  }
}

async function boot() {
  bindEvents();
  render();
  loadBuildVersion();

  try {
    const [settings, known, active] = await Promise.all([
      api.getSettings(),
      api.getKnownPlayers(),
      api.getActiveGame(),
    ]);
    state.hasApiKey = settings.has_api_key;
    state.knownPlayers = known.names;
    state.bootError = "";
    if (active) {
      state.gameId = active.id;
      state.players = active.players;
      state.rounds = active.rounds;
      state.totals = active.totals;
      state.targetScore = active.target_score;
      state.gameOver = active.game_over;
      state.phase = "playing";
      state.draft = {};
      active.players.forEach((p) => (state.draft[p.id] = ""));
    }
  } catch (e) {
    // Without this, a transient network hiccup looks exactly like "no game
    // in progress" -- the empty setup screen -- which contradicts the whole
    // point of persisting the game server-side (see CLAUDE.md: reload should
    // never look like it lost the game).
    console.error("Failed to load initial state from the backend", e);
    state.bootError = "Impossible de charger la partie en cours. Vérifie ta connexion et réessaie.";
  } finally {
    state.booted = true;
    render();
  }
}

// Last-resort net: if something escapes every try/catch in event handlers
// (async or not), fall back to a plain "reload" screen instead of leaving
// the UI frozen mid-action with no explanation.
window.addEventListener("error", (e) => {
  console.error("Uncaught error", e.error || e.message);
  renderFatal();
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection", e.reason);
  renderFatal();
});

boot();
