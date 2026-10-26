import test from "node:test";
import assert from "node:assert/strict";

import {
  BOMB_FUSE_MS,
  BOMB_RADIUS,
  EXPLOSION_MS,
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

function cellFromKey(key) {
  const [r, c] = key.split(":").map(Number);
  return { r, c };
}

test("each path starts with a bomb pickup away from the start", () => {
  const game = started();
  assert.ok(game.bombPickups.size >= 1);

  for (const key of game.bombPickups) {
    assert.ok(!game.targets.has(key));
    const cell = cellFromKey(key);
    assert.ok(game.pathIndex(cell) > 4);
  }
});

test("yy picks up one bomb at a time", () => {
  const game = started();
  const key = [...game.bombPickups][0];
  game.cursor = cellFromKey(key);

  const first = game.pickUpBomb(1000);
  assert.equal(first.picked, true);
  assert.equal(game.heldBomb, true);
  assert.equal(game.bombPickups.has(key), false);

  const second = game.pickUpBomb(2000);
  assert.equal(second.picked, false);
  assert.equal(second.reason, "holding");
  assert.equal(game.heldBomb, true);
});

test("p places a bomb forward and P places one backward", () => {
  const game = started();
  const index = 10;
  game.cursor = { ...game.path[index] };
  game.heldBomb = true;

  const forward = game.placeBomb(1, 1000);
  assert.equal(forward.placed, true);
  assert.equal(game.heldBomb, false);
  assert.deepEqual(game.activeBombs[0], {
    r: game.path[index + 1].r,
    c: game.path[index + 1].c,
    placedAt: 1000
  });

  game.heldBomb = true;
  const backward = game.placeBomb(-1, 2000);
  assert.equal(backward.placed, true);
  assert.equal(game.activeBombs[1].r, game.path[index - 1].r);
  assert.equal(game.activeBombs[1].c, game.path[index - 1].c);
});

test("a bomb explodes after 3 seconds and kills enemies in radius 5", () => {
  const game = started();
  const bombIndex = 10;
  const bombCell = game.path[bombIndex];

  let within = -1;
  let far = -1;

  for (let i = 1; i < game.path.length; i += 1) {
    if (i === bombIndex) continue;
    const cell = game.path[i];
    const distance = Math.hypot(
      cell.r - bombCell.r,
      cell.c - bombCell.c
    );
    if (within === -1 && distance <= BOMB_RADIUS) within = i;
    if (far === -1 && distance > BOMB_RADIUS + 1) far = i;
  }

  assert.ok(within >= 0);
  assert.ok(far >= 0);

  game.ghosts = [
    { index: within, dir: 1 },
    { index: far, dir: 1 }
  ];
  game.activeBombs = [
    { r: bombCell.r, c: bombCell.c, placedAt: 1000 }
  ];

  game.update(1000 + BOMB_FUSE_MS);

  assert.equal(game.ghosts.length, 1);
  assert.equal(game.ghosts[0].index, far);
  assert.equal(game.activeBombs.length, 0);
  assert.equal(game.explosions.length, 1);
  assert.equal(game.explosions[0].kills, 1);
});

test("explosion visuals expire", () => {
  const game = started();
  const bomb = game.path[10];

  game.activeBombs = [{ r: bomb.r, c: bomb.c, placedAt: 1000 }];
  game.update(1000 + BOMB_FUSE_MS);
  assert.equal(game.explosions.length, 1);

  game.update(1000 + BOMB_FUSE_MS + EXPLOSION_MS + 1);
  assert.equal(game.explosions.length, 0);
});

test("cannot place without a held bomb or onto an active bomb", () => {
  const game = started();
  game.cursor = { ...game.path[10] };

  assert.equal(game.placeBomb(1, 1000).placed, false);
  assert.equal(game.placeBomb(1, 1000).reason, "empty");

  game.heldBomb = true;
  game.activeBombs = [
    { r: game.path[11].r, c: game.path[11].c, placedAt: 1000 }
  ];

  const blocked = game.placeBomb(1, 2000);
  assert.equal(blocked.placed, false);
  assert.equal(blocked.reason, "occupied");
  assert.equal(game.heldBomb, true);
});
