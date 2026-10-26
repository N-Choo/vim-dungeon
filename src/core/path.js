const DIRS = Object.freeze([
  Object.freeze({ r: 0, c: 1 }),
  Object.freeze({ r: 1, c: 0 }),
  Object.freeze({ r: 0, c: -1 }),
  Object.freeze({ r: -1, c: 0 })
]);

export function cellKey(r, c) {
  return `${r}:${c}`;
}

export function parseCellKey(key) {
  const [r, c] = key.split(":").map(Number);
  return { r, c };
}

function isInside(p, cols, rows) {
  return p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols;
}

function randomWalk(cols, rows, targetLen, rand) {
  const walk = [];
  const used = new Set();
  const start = {
    r: 1 + Math.floor(rand() * Math.max(1, rows - 2)),
    c: 1 + Math.floor(rand() * Math.max(1, cols - 2))
  };

  walk.push(start);
  used.add(cellKey(start.r, start.c));

  let cursor = start;
  let dir = DIRS[Math.floor(rand() * DIRS.length)];
  let guard = 0;

  while (walk.length < targetLen && guard++ < targetLen * 10) {
    const next = { r: cursor.r + dir.r, c: cursor.c + dir.c };
    if (isInside(next, cols, rows) && !used.has(cellKey(next.r, next.c))) {
      cursor = next;
      walk.push(cursor);
      used.add(cellKey(cursor.r, cursor.c));
      if (rand() < 0.2) {
        const index = DIRS.indexOf(dir);
        dir = rand() < 0.5 ? DIRS[(index + 1) % 4] : DIRS[(index + 3) % 4];
      }
      continue;
    }

    const options = [];
    for (const candidate of DIRS) {
      const spot = { r: cursor.r + candidate.r, c: cursor.c + candidate.c };
      if (isInside(spot, cols, rows) && !used.has(cellKey(spot.r, spot.c))) {
        options.push(candidate);
      }
    }

    if (options.length === 0) break;
    dir = options[Math.floor(rand() * options.length)];
    cursor = { r: cursor.r + dir.r, c: cursor.c + dir.c };
    walk.push(cursor);
    used.add(cellKey(cursor.r, cursor.c));
  }

  return walk;
}

function serpentine(cols, rows) {
  const path = [];
  for (let r = 0; r < rows; r += 1) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c += 1) path.push({ r, c });
    } else {
      for (let c = cols - 1; c >= 0; c -= 1) path.push({ r, c });
    }
  }
  return path;
}

export function generatePath({ cols, rows, targetLen, rand }) {
  if (!Number.isInteger(cols) || cols < 3) {
    throw new RangeError("cols must be an integer >= 3");
  }
  if (!Number.isInteger(rows) || rows < 3) {
    throw new RangeError("rows must be an integer >= 3");
  }
  if (typeof rand !== "function") {
    throw new TypeError("rand must be a function");
  }

  const desired = Math.max(2, Math.min(targetLen, cols * rows));
  let best = [];

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const walk = randomWalk(cols, rows, desired, rand);
    if (walk.length > best.length) best = walk;
    if (best.length >= desired) break;
  }

  if (best.length < Math.min(12, desired)) {
    return serpentine(cols, rows).slice(0, desired);
  }

  return best;
}

export function placeTargets({ path, count, rand }) {
  if (!Array.isArray(path) || path.length < 2) return new Set();

  const targets = new Set();
  const wanted = Math.max(0, Math.min(count, path.length - 1));
  const firstKey = cellKey(path[0].r, path[0].c);

  for (let i = 0; i < wanted; i += 1) {
    const spread = 0.1 + (0.8 * (i + 0.5)) / wanted;
    const jitter = ((rand() - 0.5) * 0.6) / wanted;
    let index = Math.round(path.length * (spread + jitter));
    index = Math.max(1, Math.min(path.length - 1, index));

    let guard = 0;
    while (guard++ < path.length) {
      const key = cellKey(path[index].r, path[index].c);
      if (!targets.has(key) && key !== firstKey) {
        targets.add(key);
        break;
      }
      index = index + 1 < path.length ? index + 1 : 1;
    }
  }

  return targets;
}
