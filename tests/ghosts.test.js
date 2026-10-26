import test from "node:test";
import assert from "node:assert/strict";

import {
  GHOST_STEP_MS,
  HIT_INVULN_MS,
  VimDungeonGame
} from "../src/core/game.js";

function started(seed = 42, stage = 1) {
  const game = new VimDungeonGame({ seedFn: () => seed }).start({
    cols: 40,
    rows: 20,
    stage
  });
  game.blocks = new Set();
  return game;
}

function straightGame() {
  const game = started();
  game.path = Array.from({ length: 12 }, (_, i) => ({ r: 5, c: 5 + i }));
  game.pathSet = new Set(game.path.map((cell) => `${cell.r}:${cell.c}`));
  game.cursor = { ...game.path[0] };
  game.facing = { dr: 0, dc: 1 };
  game.ghosts = [];
  return game;
}

test("w jumps 3 blocks in the facing direction", () => {
  const game = straightGame();
  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.moved, true);
  assert.equal(result.jumped, true);
  assert.equal(result.ghostsJumped, 0);
  assert.deepEqual(game.cursor, { r: 5, c: 8 });
});

test("w jumps over a pac-man in the facing direction", () => {
  const game = straightGame();
  game.ghosts = [{ index: 1, dir: 1 }];

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.jumped, true);
  assert.equal(result.ghostsJumped, 1);
  assert.deepEqual(game.cursor, { r: 5, c: 8 });
});

test("b jumps 3 blocks opposite the facing direction", () => {
  const game = straightGame();
  game.cursor = { ...game.path[3] };
  game.ghosts = [{ index: 2, dir: 1 }];

  const result = game.stepAlongPath(-1, 2000);

  assert.equal(result.jumped, true);
  assert.equal(result.ghostsJumped, 1);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });
});

test("a 3-block jump clears multiple pac-men in between", () => {
  const game = straightGame();
  game.ghosts = [
    { index: 1, dir: 1 },
    { index: 2, dir: 1 }
  ];

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.ghostsJumped, 2);
  assert.deepEqual(game.cursor, { r: 5, c: 8 });
});

test("a jump shortens when the path runs out", () => {
  const game = straightGame();
  game.cursor = { ...game.path[10] };

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.moved, true);
  assert.equal(result.jumped, true);
  assert.equal(result.distance, 1);
  assert.deepEqual(game.cursor, { r: 5, c: 16 });
});

test("a jump does not cross an empty cell", () => {
  const game = straightGame();
  game.path = [
    { r: 5, c: 5 },
    { r: 5, c: 6 },
    { r: 5, c: 7 },
    { r: 5, c: 9 },
    { r: 5, c: 10 }
  ];
  game.pathSet = new Set(game.path.map((cell) => `${cell.r}:${cell.c}`));
  game.cursor = { ...game.path[0] };
  game.facing = { dr: 0, dc: 1 };
  game.ghosts = [];

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.moved, true);
  assert.equal(result.distance, 2);
  assert.deepEqual(game.cursor, { r: 5, c: 7 });
});

test("a jump is blocked when the next cell has no dot", () => {
  const game = straightGame();
  game.path = [
    { r: 5, c: 5 },
    { r: 5, c: 7 }
  ];
  game.pathSet = new Set(game.path.map((cell) => `${cell.r}:${cell.c}`));
  game.cursor = { r: 5, c: 5 };
  game.facing = { dr: 0, dc: 1 };
  game.ghosts = [];

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.moved, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });
});

test("a jump cannot land on a pac-man", () => {
  const game = straightGame();
  game.ghosts = [{ index: 3, dir: 1 }];

  const result = game.stepAlongPath(1, 1000);

  assert.equal(result.moved, false);
  assert.equal(result.blocked, true);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });
});

test("the jump direction comes from the last hjkl move", () => {
  const game = straightGame();

  game.move(1, 0, 1000);
  assert.deepEqual(game.facing, { dr: 1, dc: 0 });
  assert.equal(game.stepAlongPath(1, 2000).blocked, true);

  game.move(0, 1, 3000);
  assert.deepEqual(game.facing, { dr: 0, dc: 1 });

  const result = game.stepAlongPath(1, 4000);
  assert.equal(result.jumped, true);
  assert.deepEqual(game.cursor, { r: 5, c: 9 });
});

test("walking into a pac-man costs a heart and respawns", () => {
  const game = started();
  const path = game.path;

  game.ghosts = [{ index: 5, dir: 1 }];
  game.cursor = { ...path[4] };

  const result = game.move(
    path[5].r - path[4].r,
    path[5].c - path[4].c,
    1000
  );

  assert.equal(result.hit, true);
  assert.equal(game.hp, 2);
  assert.deepEqual(game.cursor, { r: path[0].r, c: path[0].c });
  assert.equal(game.invulnerableUntil, 1000 + HIT_INVULN_MS);
});

test("invulnerability prevents repeated hits", () => {
  const game = started();

  game.hp = 2;
  game.invulnerableUntil = 2000;

  assert.equal(game.hit(1000), false);
  assert.equal(game.hp, 2);
});

test("reaching zero hearts sets gameOver", () => {
  const game = started();
  const path = game.path;

  game.hp = 1;
  game.ghosts = [{ index: 5, dir: 1 }];
  game.cursor = { ...path[4] };

  game.move(path[5].r - path[4].r, path[5].c - path[4].c, 1000);

  assert.equal(game.hp, 0);
  assert.equal(game.gameOver, true);
  assert.equal(game.snapshot(1000).gameOver, true);
});

test("pac-men advance on the timer and bounce at the end", () => {
  const game = started();
  const path = game.path;

  game.ghosts = [{ index: 5, dir: 1 }];
  game.lastGhostStep = 1000;

  game.update(1000 + GHOST_STEP_MS);
  assert.equal(game.ghosts[0].index, 6);
  assert.equal(game.ghosts[0].dir, 1);

  game.ghosts = [{ index: path.length - 1, dir: 1 }];
  game.lastGhostStep = 2000;
  game.update(2000 + GHOST_STEP_MS);

  assert.equal(game.ghosts[0].index, path.length - 2);
  assert.equal(game.ghosts[0].dir, -1);
});

test("a pac-man landing on the player costs a heart", () => {
  const game = started();
  const path = game.path;

  game.cursor = { ...path[3] };
  game.ghosts = [{ index: 2, dir: 1 }];
  game.lastGhostStep = 1000;

  game.update(1000 + GHOST_STEP_MS);

  assert.equal(game.hp, 2);
  assert.deepEqual(game.cursor, { r: path[0].r, c: path[0].c });
});

test("each stage adds another pac-man up to the cap", () => {
  assert.equal(started(7, 1).snapshot(0).ghosts.length, 2);
  assert.equal(started(7, 2).snapshot(0).ghosts.length, 3);
  assert.equal(started(7, 3).snapshot(0).ghosts.length, 4);
  assert.equal(started(7, 4).snapshot(0).ghosts.length, 5);
  assert.equal(started(7, 5).snapshot(0).ghosts.length, 6);
  assert.equal(started(7, 6).snapshot(0).ghosts.length, 6);
});
