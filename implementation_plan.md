# Implementation Plan — Stop game from overlapping status/map

## Goal
Make the bottom "PLAYER STATUS" panel (`#bottom-status`) sit below the game canvas instead of overlaying it, without breaking any existing JS logic or tests.

## Approach
- Promote `#bottom-status` out of the `#hud` overlay layer into normal document flow, as a sibling of the canvas inside `#stage`.
- Make `#stage` a column flex container so the canvas and status panel stack vertically.
- Give the canvas a max-height so it shrinks responsively on smaller windows.
- Convert `#bottom-status` from `position: fixed` to flow-friendly centering.

## Files

### `apps/zombie-survival/index.html`
- Move the `<div id="bottom-status">` block to immediately after `<canvas id="game">` (before `#controls-hint`), removing it from inside `#hud`. Keep the inner markup and classes identical.

### `apps/zombie-survival/zombie-survival.css`
- `#stage`: `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; position: relative; width: 100%; height: 100%;`
- `canvas` base rule: add `max-height: calc(100vh - 120px);` while keeping `max-width: 100%;` and `aspect-ratio: 960 / 600;`.
- `#bottom-status`: change from `position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%);` to `position: relative; margin: 8px auto 0; transform: none;`. Keep background, border, padding, `pointer-events: none`, and `z-index`. Adjust width constraints to `min-width: min(320px, 90vw); max-width: min(65vw, 960px);`.

## Functions / Classes
None. `syncBottomStatusPanel()` keeps working; `.hidden` continues to toggle visibility and now collapses the panel out of flow.

## Dependencies
None.

## Testing
- `node tests/zombie-survival-engine.mjs`
- `node tests/zombie-survival-objectives.mjs`
- `node tests/zombie-survival-content.mjs`
- `node --check` over the zombie-survival JS files.
- Manual resize validation in the browser.

## Implementation Order
1. Relocate the DOM node in `index.html`.
2. Adjust the CSS.
3. Run automated checks.
4. Manual verification.