import { state } from "../state.js";
import { trophyIcon, historyIcon, restartIcon, keyIcon, flameIcon } from "../icons.js";

export function renderHeader() {
  const { phase, rounds, hasApiKey } = state;
  const roundCount = rounds.length;
  return `
    <div class="header">
      <div class="header-row">
        <div class="logo-card"><span class="logo-num">-2</span></div>
        <div style="flex:1">
          <h1 class="title">SKYJO ACTION</h1>
          <p class="subtitle">Feuille de score</p>
        </div>
        ${
          phase === "playing"
            ? `<button data-action="open-ranking" class="card-btn ranking-icon-btn" aria-label="Voir le classement">${trophyIcon({ size: 18 })}</button>`
            : ""
        }
        ${
          phase === "playing" && roundCount > 0
            ? `<button data-action="open-history" class="card-btn header-icon-btn" aria-label="Historique des manches">${historyIcon({ size: 16 })}</button>`
            : ""
        }
        ${
          phase === "playing"
            ? `<button data-action="request-new-game" class="card-btn header-icon-btn" aria-label="Nouvelle partie">${restartIcon({ size: 16 })}</button>`
            : ""
        }
        <button data-action="open-settings" class="card-btn header-icon-btn" aria-label="Réglages / clé API">
          ${keyIcon({ size: 16 })}
          ${!hasApiKey ? '<span class="key-dot"></span>' : ""}
        </button>
      </div>
      ${
        phase === "playing"
          ? `<div class="round-pill">${flameIcon({ size: 14 })} Manche ${rounds.length + 1}</div>`
          : ""
      }
    </div>
  `;
}
