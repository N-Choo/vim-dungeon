import { VimDungeonGame } from "./core/game.js";
import { computeGrid } from "./layout.js";
import { CanvasRenderer } from "./render/canvas.js";
import { Hud } from "./ui/hud.js";
import { config } from "./config.js";

const params = new URLSearchParams(window.location.search);
const HINTS_KEY = "vim-dungeon:hints";
const SWAP_KEY = "vim-dungeon:swap-ai";

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage failures.
  }
}

let hintsEnabled = readSetting(HINTS_KEY) !== "0";
const storedSwap = readSetting(SWAP_KEY);
let swapStartEnd = params.has("swap")
  ? params.get("swap") === "1"
  : storedSwap !== null
    ? storedSwap === "1"
    : config.swapStartEnd;
let startKey = swapStartEnd ? "A" : "I";
let endKey = swapStartEnd ? "I" : "A";

const canvas = document.getElementById("board");
const game = new VimDungeonGame();
const renderer = new CanvasRenderer(canvas);
const hud = new Hud();

const startKeyEl = document.getElementById("start-key");
const endKeyEl = document.getElementById("end-key");
const settingsButton = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const hintsCheckbox = document.getElementById("setting-hints");
const swapCheckbox = document.getElementById("setting-swap");

renderer.setBoundaryKeys({ start: startKey, end: endKey });
renderer.setHints(hintsEnabled);
hud.setHints(hintsEnabled);
hud.setSwap(swapStartEnd);
if (startKeyEl) startKeyEl.textContent = startKey;
if (endKeyEl) endKeyEl.textContent = endKey;

const MOVES = {
  h: [0, -1],
  j: [1, 0],
  k: [-1, 0],
  l: [0, 1]
};

const HOLD_STEP_MS = 160;
const heldMoves = { h: false, j: false, k: false, l: false };

let accepting = true;
let nextTimer = null;
let resizeTimer = null;
let holdMove = null;
let lastHoldStep = 0;
let lastHp = 3;
let pendingY = false;
let pendingD = false;
let settingsOpen = false;

function clearHold() {
  heldMoves.h = false;
  heldMoves.j = false;
  heldMoves.k = false;
  heldMoves.l = false;
  holdMove = null;
}

function setHints(enabled) {
  hintsEnabled = enabled;
  renderer.setHints(enabled);
  hud.setHints(enabled);
  writeSetting(HINTS_KEY, enabled ? "1" : "0");
}

function toggleHints() {
  setHints(!hintsEnabled);
}

function setSwap(enabled) {
  swapStartEnd = enabled;
  startKey = enabled ? "A" : "I";
  endKey = enabled ? "I" : "A";
  renderer.setBoundaryKeys({ start: startKey, end: endKey });
  hud.setSwap(enabled);
  if (startKeyEl) startKeyEl.textContent = startKey;
  if (endKeyEl) endKeyEl.textContent = endKey;
  writeSetting(SWAP_KEY, enabled ? "1" : "0");
}

function setSettingsOpen(open) {
  settingsOpen = open;
  settingsPanel.hidden = !open;
  settingsButton.setAttribute("aria-expanded", String(open));
}

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function newPath(stage = game.stage) {
  clearTimeout(nextTimer);
  clearHold();
  pendingY = false;
  pendingD = false;
  hud.setPending("");
  renderer.resize();
  const grid = computeGrid(window.innerWidth, window.innerHeight);
  game.start({ cols: grid.cols, rows: grid.rows, stage });
  renderer.setLayout(grid);
  accepting = true;
  lastHp = game.hp;
  hud.resetLog();
  hud.update(game.snapshot());
  hud.flash(`PATH ${pad(game.stage)}`, "collect the o · jump the pac-man");
}

function completePath() {
  accepting = false;
  clearHold();
  pendingY = false;
  pendingD = false;
  hud.setPending("");
  hud.flash("PATH CLEAR", "generating next path…");
  clearTimeout(nextTimer);
  nextTimer = setTimeout(() => {
    hud.hide();
    newPath(game.stage + 1);
  }, 950);
}

function onKey(event) {
  const key = event.key;
  const isEscape = key === "Escape";

  if (!isEscape && !/^[hjklwbxrnypPdIAH]$/.test(key)) return;
  event.preventDefault();
  if (event.repeat) return;

  if (isEscape) {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    pendingY = false;
    pendingD = false;
    hud.setPending("");
    return;
  }

  if (key === "H") {
    pendingY = false;
    pendingD = false;
    hud.setPending("");
    toggleHints();
    return;
  }

  if (settingsOpen) return;

  if (!accepting && key !== "r" && key !== "n") return;

  if (pendingY && key !== "y") {
    pendingY = false;
    hud.setPending("");
  }

  if (pendingD && key !== "d") {
    pendingD = false;
    hud.setPending("");
  }

  hud.logKey(key);

  if (key === "r") {
    newPath(game.stage);
    return;
  }
  if (key === "n") {
    newPath(game.stage + 1);
    return;
  }

  const now = performance.now();

  if (key === "y") {
    if (!pendingY) {
      pendingY = true;
      pendingD = false;
      hud.setPending("y…");
      hud.announce("press y again to pick up the bomb");
      return;
    }

    pendingY = false;
    hud.setPending("");

    const result = game.pickUpBomb(now);
    if (result.picked) hud.announce("bomb picked up — one at a time");
    else if (result.reason === "holding") hud.announce("already holding a bomb");
    else hud.announce("no bomb here");

    hud.update(game.snapshot(now));
    return;
  }

  if (key === "d") {
    if (!pendingD) {
      pendingD = true;
      pendingY = false;
      hud.setPending("d…");
      hud.announce("press d again to remove the block in front");
      return;
    }

    pendingD = false;
    hud.setPending("");

    const result = game.removeBlock(now);
    if (result.removed) hud.announce("block removed");
    else hud.announce("no block in front");

    hud.update(game.snapshot(now));
    return;
  }

  if (key === startKey || key === endKey) {
    const boundary = key === startKey ? "start" : "end";
    const result = game.jumpToLineBoundary(boundary, now);

    if (result.moved) hud.announce(`moved to line ${boundary}`);
    else hud.announce(`line ${boundary} is blocked`);

    hud.update(game.snapshot(now));
    return;
  }

  if (key === "p" || key === "P") {
    const result = game.placeBomb(key === "p" ? 1 : -1, now);

    if (result.placed) hud.announce("bomb placed — 3 seconds");
    else if (result.reason === "empty") hud.announce("no bomb held");
    else hud.announce("cannot place the bomb there");

    hud.update(game.snapshot(now));
    return;
  }

  if (MOVES[key]) {
    heldMoves[key] = true;
    holdMove = key;
    lastHoldStep = now;

    const [dr, dc] = MOVES[key];
    const result = game.move(dr, dc, now);
    if (result.blocked) hud.announce("off path");
    if (result.hit) hud.announce("hit! respawning at the start");
  } else if (key === "w" || key === "b") {
    const result = game.stepAlongPath(key === "w" ? 1 : -1, now);
    if (result.jumped) {
      const cleared = result.ghostsJumped
        ? ` over ${result.ghostsJumped} pac-${result.ghostsJumped === 1 ? "man" : "men"}`
        : "";
      hud.announce(
        `jumped ${result.distance} block${result.distance === 1 ? "" : "s"}${cleared}`
      );
    } else if (result.blocked) {
      hud.announce("cannot jump here");
    }
  } else if (key === "x") {
    const deleted = game.deleteAtCursor(now);
    if (deleted) {
      hud.announce(`target deleted, ${game.snapshot(now).remaining} remaining`);
      if (game.isComplete()) completePath();
    }
  }

  hud.update(game.snapshot(now));
}

function onKeyUp(event) {
  const key = event.key;
  if (!MOVES[key]) return;

  heldMoves[key] = false;

  if (!heldMoves.h && !heldMoves.j && !heldMoves.k && !heldMoves.l) {
    holdMove = null;
  } else if (holdMove === key) {
    holdMove = heldMoves.h
      ? "h"
      : heldMoves.j
        ? "j"
        : heldMoves.k
          ? "k"
          : "l";
  }
}

let lastHudKey = "";

function frame(now) {
  game.update(now);

  if (
    accepting &&
    !game.gameOver &&
    holdMove &&
    now - lastHoldStep >= HOLD_STEP_MS
  ) {
    lastHoldStep = now;
    const [dr, dc] = MOVES[holdMove];
    game.move(dr, dc, now);
  }

  const state = game.snapshot(now);

  if (state.hp < lastHp) {
    clearHold();
    pendingY = false;
    pendingD = false;
    hud.setPending("");
  }
  lastHp = state.hp;

  if (state.gameOver && accepting) {
    accepting = false;
    clearHold();
    pendingY = false;
    pendingD = false;
    hud.setPending("");
    hud.flash("GAME OVER", "respawning…");
    hud.announce("Game over. Restarting the path.");
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => {
      hud.hide();
      newPath(game.stage);
    }, 1200);
  }

  const hudKey = `${state.stage}:${state.hp}:${state.remaining}:${state.moves}:${state.seed}:${state.gameOver}`;
  if (hudKey !== lastHudKey) {
    hud.update(state);
    lastHudKey = hudKey;
  }

  renderer.render(state, now);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => newPath(game.stage), 220);
});

document.addEventListener("keydown", onKey);
document.addEventListener("keyup", onKeyUp);

if (settingsButton) {
  settingsButton.addEventListener("click", () => {
    setSettingsOpen(!settingsOpen);
  });
}

if (hintsCheckbox) {
  hintsCheckbox.addEventListener("change", () => {
    setHints(hintsCheckbox.checked);
  });
}

if (swapCheckbox) {
  swapCheckbox.addEventListener("change", () => {
    setSwap(swapCheckbox.checked);
  });
}
window.addEventListener("blur", clearHold);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearHold();
});

newPath(1);
requestAnimationFrame(frame);
