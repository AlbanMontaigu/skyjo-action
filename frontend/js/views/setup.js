import { state, colorFor } from "../state.js";
import { MAX_PLAYERS, TARGET, defaultName } from "../domain.js";
import { usersIcon, plusIcon, xIcon, chevronRightIcon } from "../icons.js";
import { escapeHtml } from "../util.js";

export function renderSetupPhase() {
  const players = state.setupPlayers;
  return `
    <div class="section">
      <div class="section-label">${usersIcon({ size: 15 })} Joueurs (${players.length}/${MAX_PLAYERS})</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${players
          .map(
            (p, i) => `
          <div class="player-row" data-player-id="${p.id}">
            <div class="avatar" style="background:${colorFor(p.id)}">${i + 1}</div>
            <button data-action="open-picker" data-player-id="${p.id}" class="card-btn name-input" style="text-align:left;cursor:pointer;color:${p.name ? "#241c10" : "#5c4d38"}">
              ${escapeHtml(p.name || defaultName(i))}
            </button>
            ${
              players.length > 2
                ? `<button data-action="remove-player" data-player-id="${p.id}" class="icon-btn-ghost" aria-label="Retirer">${xIcon({ size: 16 })}</button>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
      ${
        players.length < MAX_PLAYERS
          ? `<button data-action="add-player" class="card-btn add-btn">${plusIcon({ size: 16 })} Ajouter un joueur</button>`
          : ""
      }
      <button data-action="start-game" class="card-btn primary-btn">Commencer la partie ${chevronRightIcon({ size: 18 })}</button>
      ${state.setupError ? `<div class="error-box">${escapeHtml(state.setupError)}</div>` : ""}
      <p class="hint">Fin de partie dès qu'un joueur atteint ${TARGET} points. Le score le plus bas gagne.</p>
    </div>
  `;
}
