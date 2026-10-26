import test from "node:test";
import assert from "node:assert/strict";

import { mulberry32 } from "../src/core/rng.js";
import {
  cellKey,
  generatePath,
  placeTargets
} from "../src/core/path.js";

test("mulberry32 is deterministic per seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 12; i += 1) {
    assert.equal(a(), b());
  }
  assert.notEqual(mulberry32(42)(), mulberry32(43)());
});

test("generatePath returns an in-bounds, connected, non-repeating path", () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const rand = mulberry32(seed);
    const path = generatePath({ cols: 40, rows: 20, targetLen: 120, rand });

    assert.ok(path.length >= 12, `seed ${seed} produced a short path`);
    const seen = new Set();

    for (let i = 0; i < path.length; i += 1) {
      const cell = path[i];
      assert.ok(cell.r >= 0 && cell.r < 20, "row in bounds");
      assert.ok(cell.c >= 0 && cell.c < 40, "col in bounds");

      const key = cellKey(cell.r, cell.c);
      assert.ok(!seen.has(key), "no repeated cells");
      seen.add(key);

      if (i > 0) {
        const prev = path[i - 1];
        const distance =
          Math.abs(cell.r - prev.r) + Math.abs(cell.c - prev.c);
        assert.equal(distance, 1, "consecutive cells are adjacent");
      }
    }
  }
});

test("placeTargets puts unique targets on the path, never on the start", () => {
  const rand = mulberry32(7);
  const path = generatePath({ cols: 40, rows: 20, targetLen: 120, rand });
  const targets = placeTargets({ path, count: 5, rand });

  assert.equal(targets.size, 5);
  const onPath = new Set(path.map((cell) => cellKey(cell.r, cell.c)));
  for (const key of targets) assert.ok(onPath.has(key));
  assert.ok(!targets.has(cellKey(path[0].r, path[0].c)));
});

test("placeTargets clamps to the number of non-start cells", () => {
  const path = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 }
  ];
  const targets = placeTargets({ path, count: 8, rand: mulberry32(1) });
  assert.ok(targets.size <= 2);
});
