# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Skyjo score sheet. The **entire application is `index.html`** — markup, styles,
React components and logic in one file, ~1300 lines. There is no build step, no
`package.json`, no test runner, no bundler.

React 18, ReactDOM and `@babel/standalone` are loaded from unpkg CDNs; the app
code lives in a single `<script type="text/babel">` block and is transpiled in
the browser at load time.

## Hard constraints

These are deliberate design choices, not gaps to fill in:

- **One file.** Do not split `index.html` into modules, add a bundler, or
  introduce `npm` dependencies. The app must keep working from a plain
  double-click on a local file and from any static host.
- **No npm packages.** The icon set is hand-inlined SVG (a stand-in for
  `lucide-react`) precisely to avoid a dependency. Add new icons the same way,
  next to the existing ones.
- **Inline styles.** All styling goes through the `styles` object at the bottom
  of the script. The `<style>` block in `<head>` is reserved for what inline
  styles cannot express: `@import`, `@keyframes`, pseudo-classes, resets.
- **Runs offline-ish.** CDN assets are the only network dependency at load.
  Don't add more.

## Language convention

- **User-facing text is French** — every label, button, hint, error message and
  the vision prompt sent to Claude.
- **Code is English** — identifiers, comments, commit messages, and this file.
- **Docs**: `README.md` and `docs/` are French, matching the product.

Keep both sides consistent when you touch a string.

## Code conventions

- Function components only, hooks only. No classes, no external state library.
- All state lives in `SkyjoScorer`; children are presentational and receive
  props. Modals are conditionally rendered siblings at the end of the tree, not
  portals.
- **Always use the functional form of `setState` for the per-player maps**
  (`calcCards`, `draft`, `photoLoading`, `photoError`). These objects are keyed
  by player id and the photo lookup resolves asynchronously — spreading a stale
  closure value silently drops another player's data. There is a comment in the
  source explaining this; don't regress it.
- Comments explain *why*, not *what*. Match the existing density: the file is
  lightly commented, with real explanations at the non-obvious spots (the STAR
  sentinel, the `REMOVED` sentinel, the setState pattern, the colour bands).

## Verifying a change

There are no automated tests. To check a change, open `index.html` in a browser
and walk the flow — see [docs/development.md](docs/development.md) for the
manual checklist. At minimum, after any change to scoring or the grid:

1. Setup with 2 players → start.
2. Fill one score via the 3×4 grid, one by hand → validate → pick a closer.
3. Confirm the doubling rule fired (or didn't) as expected in the history modal.

## Where things are

| Area | Location in `index.html` |
| --- | --- |
| Inline SVG icons | top of the script block |
| Domain constants & helpers | `STAR`, `REMOVED`, `band()`, `CARD_VALUES`, `TARGET` |
| Vision prompt | `VISION_PROMPT` |
| Root state & handlers | `SkyjoScorer` |
| Screens | `SetupPhase`, `PlayingPhase` |
| Modals | `*Modal` components |
| Styles | `styles` object, bottom of the script |

## Domain notes worth knowing

- A grid cell holds one of: a number (−2…12), `STAR` (`"s"`, a joker worth 0 but
  a physically distinct card from the blue `0`), `REMOVED` (`"x"`, a discarded
  full column or row), or `null` (card present but not entered yet).
- Removing a column or a row removes **all** its cells at once — that mirrors the
  Skyjo rule where 3 or 4 identical cards are discarded together. Never expose a
  per-cell "remove".
- The closer's round score doubles unless it is *strictly* the lowest of the
  round. Ties do not protect the closer.

Details in [docs/game-rules.md](docs/game-rules.md) and
[docs/data-model.md](docs/data-model.md).
