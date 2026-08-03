// Boot sequence: bind events once, paint immediately, then load settings /
// the known-player roster / any in-progress game from the backend and
// resume straight into it -- this is what fixes the old app's "a reload
// loses the game" limitation, now that state lives in SQLite instead of
// only in memory.
import { state, render } from "./state.js";
import { bindEvents } from "./events.js";
import * as api from "./api.js";

async function boot() {
  bindEvents();
  render();

  try {
    const [settings, known, active] = await Promise.all([
      api.getSettings(),
      api.getKnownPlayers(),
      api.getActiveGame(),
    ]);
    state.hasApiKey = settings.has_api_key;
    state.knownPlayers = known.names;
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
    console.error("Failed to load initial state from the backend", e);
  } finally {
    state.booted = true;
    render();
  }
}

boot();
