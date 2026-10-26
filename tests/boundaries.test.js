import test from "node:test";
import assert from "node:assert/strict";

import { VimDungeonGame } from "../src/core/game.js";

function started(seed = 42) {
  return new VimDungeonGame({ seedFn: () => seed }).start({
    cols: 40,
    rows: 20,
    stage: 1
  });
}

function lineGame() {
  const game = started();
  game.path = [
    { r: 5, c: 5 },
    { r: 5, c: 6 },
    { r: 5, c: 7 },
    { r: 5, c: 8 },
    { r: 6, c: 8 },
    { r: 7, c: 8 },
    { r: 8, c: 8 }
  ];
  game.pathSet = new Set(game.path.map((cell) => `${cell.r}:${cell.c}`));
  game.buildLines();
  game.cursor = { r: 5, c: 6 };
  game.facing = { dr: 0, dc: 1 };
  game.ghosts = [];
  game.blocks = new Set();
  game.bombPickups = new Set();
  return game;
}

test("I and A jump to the current line's start and end", () => {
  const game = lineGame();

  const toStart = game.jumpToLineBoundary("start", 1000);
  assert.equal(toStart.moved, true);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });

  const toEnd = game.jumpToLineBoundary("end", 2000);
  assert.equal(toEnd.moved, true);
  assert.deepEqual(game.cursor, { r: 5, c: 8 });

  game.cursor = { r: 7, c: 8 };

  game.jumpToLineBoundary("start", 3000);
  assert.deepEqual(game.cursor, { r: 6, c: 8 });

  game.jumpToLineBoundary("end", 4000);
  assert.deepEqual(game.cursor, { r: 8, c: 8 });
});

test("a turn cell belongs to the previous line", () => {
  const game = lineGame();
  game.cursor = { r: 5, c: 8 };

  game.jumpToLineBoundary("start", 1000);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });

  game.cursor = { r: 6, c: 8 };
  game.jumpToLineBoundary("end", 2000);
  assert.deepEqual(game.cursor, { r: 8, c: 8 });
});

test("a blocker between the cursor and line end stops the jump", () => {
  const game = lineGame();
  game.blocks = new Set(["5:7"]);

  const result = game.jumpToLineBoundary("end", 1000);

  assert.equal(result.moved, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(game.cursor, { r: 5, c: 6 });
});

test("a blocker at the line end stops the jump", () => {
  const game = lineGame();
  game.blocks = new Set(["5:8"]);

  const result = game.jumpToLineBoundary("end", 1000);

  assert.equal(result.moved, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(game.cursor, { r: 5, c: 6 });
});

test("jumping onto a pac-man at the line boundary costs a heart", () => {
  const game = lineGame();
  game.ghosts = [{ index: 3, dir: 1 }];

  const result = game.jumpToLineBoundary("end", 1000);

  assert.equal(result.moved, true);
  assert.equal(result.hit, true);
  assert.equal(game.hp, 2);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });
});
