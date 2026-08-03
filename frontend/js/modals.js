import { state, colorFor, sortedPlayers } from "./state.js";
import { CARD_VALUES, band, isCard, cardValue, STAR, REMOVED } from "./domain.js";
import {
  xIcon,
  flameIcon,
  deleteIcon,
  cameraIcon,
  imageIcon,
  checkIcon,
  pencilIcon,
  trophyIcon,
  chevronRightIcon,
  historyIcon,
  restartIcon,
  keyIcon,
} from "./icons.js";
import { escapeHtml } from "./util.js";

// All modals share the same shell: a full-screen overlay (`data-overlay`,
// closes on a direct click) around a bottom sheet (`modal-card`, clicks
// inside never reach the overlay because the delegated handler stops at the
// nearest `[data-action]` ancestor -- see events.js).

export function renderCloserModal() {
  const players = state.players;
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="closer">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="closer" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          ${flameIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title" style="font-size:18px">Qui a fini la manche ?</h2>
          <p class="podium-sub">A retourné toutes ses cartes</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${players
            .map(
              (p) => `
            <button data-action="pick-closer" data-player-id="${p.id}" class="card-btn closer-chip" style="justify-content:flex-start;padding:12px 14px;border-left-color:${colorFor(p.id)};border-left-width:3px">
              <span class="player-dot" style="background:${colorFor(p.id)}"></span> ${escapeHtml(p.name)}
            </button>
          `
            )
            .join("")}
        </div>
        <p class="tiny-hint" style="text-align:center;margin-top:10px">Règle : si son score de manche n'est pas strictement le plus bas, il est doublé automatiquement.</p>
      </div>
    </div>
  `;
}

export function renderCardValueModal() {
  const { playerId, idx } = state.cellModal;
  const grid = state.calcCards[playerId] || Array(12).fill(null);
  const current = grid[idx];
  const hasValue = current !== null && current !== undefined;
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const colIndices = [col, col + 4, col + 8];
  const rowIndices = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
  const colRemoved = colIndices.every((i) => grid[i] === REMOVED);
  const rowRemoved = rowIndices.every((i) => grid[i] === REMOVED);
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="cell">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="cell" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          <h2 class="podium-title" style="font-size:18px">Valeur de la carte</h2>
        </div>
        <div class="keypad">
          ${CARD_VALUES.map((v) => {
            const c = band(v);
            const shadow = v === STAR ? ";text-shadow:0 1px 3px rgba(0,0,0,0.55)" : "";
            return `<button data-action="pick-cell-value" data-value="${v}" class="card-btn keypad-btn" style="background:${c.bg};color:${c.fg}${shadow}">${v === STAR ? "★" : v}</button>`;
          }).join("")}
        </div>
        <p class="tiny-hint" style="margin-top:10px;text-align:center">Une colonne (3 cartes identiques) ou une ligne (4 cartes identiques) entière défaussée ?</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:4px">
          ${
            hasValue
              ? `<button data-action="delete-cell-value" class="card-btn ghost-btn" style="margin-top:0">${deleteIcon({ size: 15 })} Suppr.</button>`
              : ""
          }
          <button data-action="toggle-column" class="card-btn ghost-btn${colRemoved ? " ghost-btn-active" : ""}" style="margin-top:0">${colRemoved ? "Rétablir" : "Colonne"}</button>
          <button data-action="toggle-row" class="card-btn ghost-btn${rowRemoved ? " ghost-btn-active" : ""}" style="margin-top:0">${rowRemoved ? "Rétablir" : "Ligne"}</button>
        </div>
      </div>
    </div>
  `;
}

export function renderPhotoSourceModal() {
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="photoSource">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="photoSource" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          ${cameraIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title" style="font-size:18px">Photo de la grille</h2>
        </div>
        <div style="display:flex;gap:8px;justify-content:center">
          <label class="card-btn primary-btn" style="margin-top:0;position:relative;flex:1;width:auto">
            ${cameraIcon({ size: 16 })} Photo
            <input type="file" accept="image/*" capture="environment" data-action="photo-selected" class="hidden-file-input">
          </label>
          <label class="card-btn ghost-btn" style="margin-top:0;position:relative;flex:1">
            ${imageIcon({ size: 16 })} Galerie
            <input type="file" accept="image/*" data-action="photo-selected" class="hidden-file-input">
          </label>
        </div>
        <p class="hint">« Photo » ouvre directement l'appareil. Si la permission caméra est refusée, utilise plutôt « Galerie ».</p>
      </div>
    </div>
  `;
}

export function renderPhotoReviewModal() {
  const rawGrid = state.calcCards[state.photoReviewFor] || [];
  const grid = rawGrid.length === 12 ? rawGrid : Array(12).fill(null);
  const removedCount = grid.filter((v) => v === REMOVED).length;
  const filledCount = grid.filter(isCard).length;
  const totalPossible = 12 - removedCount;
  const sum = grid.reduce((a, b) => a + (isCard(b) ? cardValue(b) : 0), 0);
  return `
    <div class="modal-overlay" data-overlay data-action="confirm-photo-review">
      <div class="modal-card">
        <div class="podium-wrap" style="padding-top:4px">
          ${cameraIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title" style="font-size:18px">Grille détectée</h2>
          <p class="podium-sub">Vérifie avant de valider</p>
        </div>
        <div class="board-grid">
          ${grid
            .map((v) => {
              const filled = isCard(v);
              const removed = v === REMOVED;
              const c = filled ? band(v) : null;
              const shadow = v === STAR ? ";text-shadow:0 1px 3px rgba(0,0,0,0.55)" : "";
              const style = `cursor:default;background:${filled ? c.bg : "rgba(30,20,10,0.045)"};color:${filled ? c.fg : "#9c8f70"};border-color:rgba(30,20,10,0.15);border-style:${removed ? "dashed" : "solid"};border-width:1px;opacity:${removed ? 0.5 : 1}${shadow}`;
              return `<div class="board-cell" style="${style}">${filled ? (v === STAR ? "★" : v) : removed ? "×" : ""}</div>`;
            })
            .join("")}
        </div>
        <p class="tiny-hint" style="text-align:center;margin-top:2px">${filledCount}/${totalPossible} cartes${removedCount > 0 ? ` (${removedCount} retirée${removedCount > 1 ? "s" : ""})` : ""} · total <b>${sum}</b></p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button data-action="confirm-photo-review" class="card-btn primary-btn" style="margin-top:0">${checkIcon({ size: 16 })} Correct</button>
          <button data-action="correct-photo-review" class="card-btn ghost-btn" style="margin-top:0">${pencilIcon({ size: 15 })} Corriger</button>
        </div>
      </div>
    </div>
  `;
}

export function renderRankingModal() {
  const players = sortedPlayers();
  const { totals, rounds, gameOver } = state;
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="ranking">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="ranking" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        ${
          gameOver
            ? `
          <div class="podium-wrap">
            ${trophyIcon({ size: 30, color: "#7d5108" })}
            <h2 class="podium-title">${players[0] ? escapeHtml(players[0].name) : ""} remporte la partie !</h2>
            <p class="podium-sub">${players[0] ? totals[players[0].id] : ""} points</p>
          </div>
        `
            : `
          <div class="podium-wrap">
            ${trophyIcon({ size: 26, color: "#7d5108" })}
            <h2 class="podium-title">Classement</h2>
            <p class="podium-sub">Manche ${rounds.length + 1} en cours</p>
          </div>
        `
        }
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
          ${players
            .map(
              (p, i) => `
            <div class="rank-row" style="border-left-color:${colorFor(p.id)};border-left-width:4px">
              <span class="rank-num">${i + 1}</span>
              <span class="rank-name">${escapeHtml(p.name)}</span>
              <span class="rank-score">${totals[p.id]} pts</span>
            </div>
          `
            )
            .join("")}
        </div>
        ${
          gameOver
            ? `
          ${state.rematchError ? `<div class="error-box">${escapeHtml(state.rematchError)}</div>` : ""}
          <div style="display:flex;gap:8px;justify-content:center">
            <button data-action="new-game" class="card-btn ghost-btn" style="margin-top:0">Nouvelle partie</button>
            <button data-action="rematch" class="card-btn primary-btn" style="margin-top:0">Revanche</button>
          </div>
        `
            : `
          <div style="display:flex;justify-content:center">
            <button data-action="close-modal" data-modal="ranking" class="card-btn primary-btn">Reprendre la partie ${chevronRightIcon({ size: 18 })}</button>
          </div>
        `
        }
        ${rounds.length > 0 ? `<p class="hint">${rounds.length} manches jouées</p>` : ""}
      </div>
    </div>
  `;
}

export function renderHistoryModal() {
  const { players, rounds } = state;
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="history">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="history" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          ${historyIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title" style="font-size:18px">Historique</h2>
        </div>
        <div style="overflow-x:auto">
          <table class="table">
            <thead>
              <tr>
                <th class="th">M.</th>
                ${players
                  .map(
                    (p) =>
                      `<th class="th" style="color:${colorFor(p.id)};border-bottom-width:2px;border-bottom-style:solid;border-bottom-color:${colorFor(p.id)}">${escapeHtml(p.name)}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rounds
                .map(
                  (r, i) => `
                <tr>
                  <td class="td">${i + 1}</td>
                  ${players
                    .map((p) => {
                      const v = r.scores[p.id];
                      const c = band(v);
                      const doubled = r.closer_game_player_id === p.id && r.closer_doubled;
                      return `<td class="td"><span class="score-chip" style="background:${c.bg};color:${c.fg}">${v}${doubled ? "×2" : ""}</span></td>`;
                    })
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function renderConfirmNewGameModal() {
  const roundCount = state.rounds.length;
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="confirmNewGame">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="confirmNewGame" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          ${restartIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title" style="font-size:18px">Nouvelle partie ?</h2>
        </div>
        <p class="tiny-hint" style="text-align:center;margin-bottom:4px">${roundCount} manche${roundCount > 1 ? "s" : ""} déjà jouée${roundCount > 1 ? "s" : ""}. Les scores seront effacés.</p>
        <div style="display:flex;gap:8px;justify-content:center">
          <button data-action="close-modal" data-modal="confirmNewGame" class="card-btn ghost-btn" style="margin-top:0">Annuler</button>
          <button data-action="confirm-new-game" class="card-btn primary-btn" style="margin-top:0">${restartIcon({ size: 16 })} Effacer</button>
        </div>
      </div>
    </div>
  `;
}

export function renderSettingsModal() {
  const { hasApiKey, settingsValue, settingsVisible, settingsError } = state;
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="settings">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="settings" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap">
          ${keyIcon({ size: 26, color: "#7d5108" })}
          <h2 class="podium-title">Clé API Anthropic</h2>
          <p class="podium-sub">Pour la fonction photo uniquement</p>
        </div>
        <p class="tiny-hint" style="margin-top:10px;margin-bottom:10px;text-align:center">
          Nécessaire pour que Claude lise les cartes sur une photo. Elle est stockée côté serveur (base
          SQLite) et n'est envoyée qu'à l'API Anthropic. Sans clé, tu peux toujours saisir les scores à
          la main ou via la calculatrice grille.
        </p>
        <div style="display:flex;gap:8px">
          <input
            type="${settingsVisible ? "text" : "password"}"
            data-bind="settingsValue"
            value="${escapeHtml(settingsValue)}"
            placeholder="${hasApiKey ? "•••••••••••• (clé déjà enregistrée)" : "sk-ant-..."}"
            class="name-input" style="flex:1;font-family:monospace;font-size:13px"
            autocapitalize="off" autocorrect="off" spellcheck="false"
          >
          <button data-action="toggle-key-visibility" class="card-btn ghost-btn-small">${settingsVisible ? "Cacher" : "Voir"}</button>
        </div>
        ${settingsError ? `<div class="error-box" style="margin-top:10px">${escapeHtml(settingsError)}</div>` : ""}
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
          <button data-action="save-api-key" class="card-btn primary-btn" style="margin-top:0;flex:1">Enregistrer</button>
          ${hasApiKey ? `<button data-action="remove-api-key" class="card-btn ghost-btn" style="margin-top:0;flex:1">Retirer</button>` : ""}
        </div>
        <p class="hint" style="margin-top:10px">
          Récupère ou crée une clé sur
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style="color:#7d5108">console.anthropic.com</a>.
          L'usage de l'API est facturé séparément par Anthropic selon ta consommation.
        </p>
      </div>
    </div>
  `;
}

export function renderNamePickerModal() {
  const editing = state.setupPlayers.find((p) => p.id === state.pickerFor);
  if (!editing) return "";
  const taken = state.setupPlayers
    .map((p) => p.name.trim())
    .filter(Boolean)
    .filter((n) => n !== editing.name.trim());
  return `
    <div class="modal-overlay" data-overlay data-action="close-modal" data-modal="picker">
      <div class="modal-card">
        <button data-action="close-modal" data-modal="picker" class="modal-close-btn card-btn" aria-label="Fermer">${xIcon({ size: 18 })}</button>
        <div class="podium-wrap" style="padding-top:4px">
          <h2 class="podium-title" style="font-size:18px">Qui joue ?</h2>
        </div>
        <div class="name-chips">
          ${state.knownPlayers
            .map((n) => {
              const isTaken = taken.includes(n);
              const isCurrent = n === editing.name;
              return `<button data-action="pick-name" data-name="${escapeHtml(n)}" ${isTaken ? "disabled" : ""} class="card-btn name-chip${isCurrent ? " name-chip-active" : ""}" style="opacity:${isTaken ? 0.35 : 1};cursor:${isTaken ? "not-allowed" : "pointer"}">${escapeHtml(n)}</button>`;
            })
            .join("")}
        </div>
        <p class="tiny-hint" style="margin-top:10px">Ou un autre nom :</p>
        <div style="display:flex;gap:8px;margin-top:4px">
          <input data-bind="pickerCustomName" value="${escapeHtml(state.pickerCustomName)}" placeholder="Nom du joueur" class="name-input" style="flex:1" maxlength="16">
          <button data-action="pick-custom-name" class="card-btn primary-btn" style="margin-top:0;width:auto;padding:12px 18px">OK</button>
        </div>
      </div>
    </div>
  `;
}
