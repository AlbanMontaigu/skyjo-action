import { state, colorFor } from "../state.js";
import { band, isCard, cardValue, STAR, REMOVED } from "../domain.js";
import {
  trophyIcon,
  chevronRightIcon,
  cameraIcon,
  loader2Icon,
  calculatorIcon,
  pencilIcon,
  deleteIcon,
} from "../icons.js";
import { escapeHtml } from "../util.js";

export function renderPlayingPhase() {
  const { players, gameOver, error } = state;

  if (gameOver) {
    return `
      <div class="section">
        <div class="game-over-banner">
          ${trophyIcon({ size: 20, color: "#7d5108" })}
          <div>
            <div class="game-over-title">Partie terminée</div>
            <div class="game-over-sub">Consulte le classement final</div>
          </div>
          <button data-action="open-ranking" class="card-btn game-over-btn">Classement ${chevronRightIcon({ size: 16 })}</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <div class="form-card">
        <div class="section-label">Scores de la manche</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${players.map((p) => renderScoreRow(p)).join("")}
        </div>
        ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}
      </div>
      <button data-action="open-closer-modal" class="card-btn primary-btn">Valider la manche ${chevronRightIcon({ size: 18 })}</button>
    </div>
  `;
}

function renderScoreRow(p) {
  const isOpen = state.calcOpenId === p.id;
  const isManualOpen = state.manualOpenId === p.id;
  const draftVal = state.draft[p.id];
  const hasDraft = draftVal !== "" && draftVal !== undefined;
  const loading = !!state.photoLoading[p.id];
  const photoErr = state.photoError[p.id];

  return `
    <div>
      <div class="score-row">
        <span class="player-dot" style="background:${colorFor(p.id)}"></span>
        <span class="score-row-name">${escapeHtml(p.name)}</span>
        <button data-action="open-photo-source" data-player-id="${p.id}" class="card-btn calc-toggle" style="opacity:${loading ? 0.6 : 1};pointer-events:${loading ? "none" : "auto"}" aria-label="Photo de la grille">
          ${loading ? loader2Icon({ size: 15, className: "spin" }) : cameraIcon({ size: 15 })}
        </button>
        <button data-action="toggle-calc" data-player-id="${p.id}" class="card-btn calc-toggle${isOpen ? " calc-toggle-active" : ""}" aria-label="Assistant de calcul">
          ${calculatorIcon({ size: 15 })}
        </button>
        <button data-action="toggle-manual" data-player-id="${p.id}" class="card-btn calc-toggle${isManualOpen ? " calc-toggle-active" : ""}" aria-label="Saisie manuelle" aria-expanded="${isManualOpen}">
          ${pencilIcon({ size: 15 })}
        </button>
        ${
          isManualOpen
            ? `<input type="number" inputmode="numeric" data-bind="draft" data-player-id="${p.id}" value="${draftVal ?? ""}" placeholder="0" class="score-input">`
            : `<span class="score-readout">${hasDraft ? escapeHtml(draftVal) : "–"}</span>`
        }
      </div>
      ${photoErr ? `<p class="photo-error-text">${escapeHtml(photoErr)}</p>` : ""}
      ${isOpen ? renderCalcPanel(p) : ""}
    </div>
  `;
}

function renderCalcPanel(p) {
  const grid = state.calcCards[p.id] || Array(12).fill(null);
  const removedCount = grid.filter((v) => v === REMOVED).length;
  const filledCount = grid.filter(isCard).length;
  const totalPossible = 12 - removedCount;
  const sum = grid.reduce((a, b) => a + (isCard(b) ? cardValue(b) : 0), 0);

  return `
    <div class="calc-panel">
      <div class="board-grid">
        ${grid
          .map((v, idx) => {
            const filled = isCard(v);
            const removed = v === REMOVED;
            const c = filled ? band(v) : null;
            const style = `background:${filled ? c.bg : "rgba(30,20,10,0.045)"};color:${filled ? c.fg : "#9c8f70"};border-color:rgba(30,20,10,0.15);border-style:${removed ? "dashed" : "solid"};border-width:1px;opacity:${removed ? 0.5 : 1}${v === STAR ? ";text-shadow:0 1px 3px rgba(0,0,0,0.55)" : ""}`;
            return `<button data-action="open-cell-modal" data-player-id="${p.id}" data-idx="${idx}" class="card-btn board-cell" style="${style}">${filled ? (v === STAR ? "★" : v) : removed ? "×" : ""}</button>`;
          })
          .join("")}
      </div>
      <div class="calc-summary">
        <span>${filledCount}/${totalPossible} cartes${removedCount > 0 ? ` (${removedCount} retirée${removedCount > 1 ? "s" : ""})` : ""} · total <b>${sum}</b></span>
        <button data-action="clear-calc" data-player-id="${p.id}" class="card-btn calc-clear-btn" style="visibility:${grid.some((v) => v !== null) ? "visible" : "hidden"}">
          ${deleteIcon({ size: 13 })} Effacer
        </button>
      </div>
      <p class="tiny-hint">Touche une case de la grille pour choisir sa valeur (ou la supprimer). Une colonne/ligne entière déjà défaussée ? Marque-la depuis la même case. Ou utilise 📷 pour remplir la grille depuis une photo.</p>
    </div>
  `;
}
