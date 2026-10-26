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

function straightGame() {
  const game = started();
  game.path = Array.from({ length: 12 }, (_, i) => ({ r: 5, c: 5 + i }));
  game.pathSet = new Set(game.path.map((cell) => `${cell.r}:${cell.c}`));
  game.cursor = { ...game.path[0] };
  game.facing = { dr: 0, dc: 1 };
  game.ghosts = [];
  game.blocks = new Set();
  return game;
}

test("each path gets a random 3-5 blockers on path dots", () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const game = started(seed);
    assert.ok(
      game.blocks.size >= 3 && game.blocks.size <= 5,
      `seed ${seed} produced ${game.blocks.size} blocks`
    );

    for (const key of game.blocks) {
      assert.ok(game.pathSet.has(key));
      assert.ok(!game.targets.has(key));
      assert.ok(!game.bombPickups.has(key));
    }
  }
});

test("a blocker stops movement until dd removes it", () => {
  const game = straightGame();
  game.blocks = new Set(["5:6"]);
  game.cursor = { r: 5, c: 5 };
  game.facing = { dr: 0, dc: 1 };

  const blocked = game.move(0, 1, 1000);
  assert.equal(blocked.moved, false);
  assert.equal(blocked.blocked, true);
  assert.deepEqual(game.cursor, { r: 5, c: 5 });

  const removed = game.removeBlock(2000);
  assert.equal(removed.removed, true);
  assert.equal(game.blocks.size, 0);

  const moved = game.move(0, 1, 3000);
  assert.equal(moved.moved, true);
  assert.deepEqual(game.cursor, { r: 5, c: 6 });
});

test("dd only removes a blocker in the facing direction", () => {
  const game = straightGame();
  game.blocks = new Set(["5:6"]);
  game.cursor = { r: 5, c: 5 };
  game.facing = { dr: 1, dc: 0 };

  const wrong = game.removeBlock(1000);
  assert.equal(wrong.removed, false);
  assert.ok(game.blocks.has("5:6"));

  game.facing = { dr: 0, dc: 1 };
  const right = game.removeBlock(2000);
  assert.equal(right.removed, true);
  assert.equal(game.blocks.size, 0);
});

test("a blocker blocks a jump until it is removed", () => {
  const game = straightGame();
  game.blocks = new Set(["5:6"]);
  game.cursor = { r: 5, c: 5 };
  game.facing = { dr: 0, dc: 1 };

  const blocked = game.stepAlongPath(1, 1000);
  assert.equal(blocked.moved, false);
  assert.equal(blocked.blocked, true);

  const removed = game.removeBlock(2000);
  assert.equal(removed.removed, true);

  const jumped = game.stepAlongPath(1, 3000);
  assert.equal(jumped.moved, true);
  assert.equal(jumped.distance, 3);
  assert.deepEqual(game.cursor, { r: 5, c: 8 });
});

test("a blocker prevents bomb placement on its dot", () => {
  const game = straightGame();
  game.blocks = new Set(["5:6"]);
  game.cursor = { r: 5, c: 5 };
  game.facing = { dr: 0, dc: 1 };
  game.heldBomb = true;

  const result = game.placeBomb(1, 1000);

  assert.equal(result.placed, false);
  assert.equal(result.reason, "occupied");
  assert.equal(game.heldBomb, true);
});
