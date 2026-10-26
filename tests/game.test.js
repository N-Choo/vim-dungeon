import test from "node:test";
import assert from "node:assert/strict";

import { BLOCK_FLASH_MS, VimDungeonGame } from "../src/core/game.js";
import { cellKey } from "../src/core/path.js";

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0]
];

function started(seed = 42, stage = 1) {
  return new VimDungeonGame({ seedFn: () => seed }).start({
    cols: 40,
    rows: 20,
    stage
  });
}

test("start builds a playable path with targets", () => {
  const game = started();
  const state = game.snapshot(1000);

  assert.ok(state.path.length > 10);
  assert.equal(state.cursor.r, state.path[0].r);
  assert.equal(state.cursor.c, state.path[0].c);
  assert.ok(state.targets.size >= 3);
  assert.equal(state.complete, false);
  assert.equal(state.moves, 0);
  assert.equal(state.hp, 3);
  assert.ok(state.ghosts.length >= 2);
  assert.ok(state.blocks.length >= 3 && state.blocks.length <= 5);
});

test("movement follows the path and off-path bumps flash red", () => {
  const game = started(7);
  const start = game.snapshot(0);

  const blockedDirection = DIRECTIONS.find(
    ([dr, dc]) =>
      !start.pathSet.has(cellKey(start.cursor.r + dr, start.cursor.c + dc))
  );
  assert.ok(blockedDirection, "an endpoint always has an off-path side");

  const blocked = game.move(blockedDirection[0], blockedDirection[1], 30);
  assert.equal(blocked.moved, false);
  assert.equal(blocked.blocked, true);
  assert.deepEqual(game.snapshot(30).cursor, start.cursor);
  assert.equal(game.snapshot(30).blocked, true);
  assert.equal(game.snapshot(30 + BLOCK_FLASH_MS + 1).blocked, false);

  const next = start.path[1];
  const moved = game.move(
    next.r - start.cursor.r,
    next.c - start.cursor.c,
    1000
  );
  assert.equal(moved.moved, true);
  assert.deepEqual(game.snapshot(1000).cursor, { r: next.r, c: next.c });
});

test("deleting every target completes the path", () => {
  const game = started(99);
  game.ghosts = [];
  game.blocks = new Set();
  const path = game.snapshot(0).path;

  for (let i = 0; i < path.length && !game.isComplete(); i += 1) {
    if (i > 0) {
      const prev = path[i - 1];
      const cell = path[i];
      game.move(cell.r - prev.r, cell.c - prev.c, 1000 + i);
    }

    const state = game.snapshot(1000 + i);
    if (state.targets.has(cellKey(state.cursor.r, state.cursor.c))) {
      assert.equal(game.deleteAtCursor(1000 + i), true);
    }
  }

  assert.equal(game.isComplete(), true);
  assert.equal(game.snapshot(5000).remaining, 0);
});

test("advanceStage raises the stage and resets the run", () => {
  const game = started(5, 1);
  game.move(0, 1, 10);

  game.advanceStage();
  const state = game.snapshot(0);

  assert.equal(state.stage, 2);
  assert.equal(state.moves, 0);
  assert.ok(state.targets.size >= 3);
});

test("restartPath keeps the stage but generates a new run", () => {
  const game = started(11, 3);
  game.move(0, 1, 10);
  const before = game.snapshot(20);

  game.restartPath();
  const after = game.snapshot(20);

  assert.equal(after.stage, before.stage);
  assert.equal(after.moves, 0);
  assert.equal(after.cursor.r, after.path[0].r);
});
