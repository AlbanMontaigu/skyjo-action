// Thin fetch() wrappers around the FastAPI backend. Every function either
// resolves with the parsed JSON body or throws an Error whose `.message` is
// the backend's `detail` (or a generic fallback) -- callers show that
// message directly to the user where relevant (e.g. photo errors).

async function request(method, url, { json, formData } = {}) {
  const opts = { method, headers: {} };
  if (json !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  } else if (formData !== undefined) {
    opts.body = formData;
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch {
      // non-JSON error body, keep the generic message
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const getSettings = () => request("GET", "/api/settings");
export const saveApiKey = (api_key) => request("PUT", "/api/settings/api-key", { json: { api_key } });
export const removeApiKey = () => request("DELETE", "/api/settings/api-key");

export const getKnownPlayers = () => request("GET", "/api/players/known");

export const getActiveGame = () => request("GET", "/api/games/active");
export const createGame = (players) => request("POST", "/api/games", { json: { players } });
export const submitRound = (gameId, scores, closerGamePlayerId) =>
  request("POST", `/api/games/${gameId}/rounds`, {
    json: { scores, closer_game_player_id: closerGamePlayerId },
  });
export const endGame = (gameId) => request("POST", `/api/games/${gameId}/end`);
export const rematchGame = (gameId) => request("POST", `/api/games/${gameId}/rematch`);

export const readGridFromPhoto = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return request("POST", "/api/vision/read-grid", { formData });
};
