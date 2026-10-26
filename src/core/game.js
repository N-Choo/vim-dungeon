import { cellKey, generatePath, placeTargets } from "./path.js";
import { mulberry32, randomSeed } from "./rng.js";

export const BLOCK_FLASH_MS = 190;
export const GHOST_STEP_MS = 280;
export const HIT_INVULN_MS = 1200;
const JUMP_DISTANCE = 3;
export const BOMB_FUSE_MS = 3000;
export const BOMB_RADIUS = 5;
export const EXPLOSION_MS = 700;
const MAX_PATH = 320;
const MAX_TARGETS = 8;
const MAX_GHOSTS = 6;

export class VimDungeonGame {
  constructor({
    now = () => performance.now(),
    seedFn = randomSeed,
    ghostStepMs = GHOST_STEP_MS
  } = {}) {
    this.now = now;
    this.seedFn = seedFn;
    this.ghostStepMs = ghostStepMs;
    this.stage = 1;
    this.cols = 0;
    this.rows = 0;
    this.seed = 0;
    this.moves = 0;
    this.path = [];
    this.pathSet = new Set();
    this.lines = [];
    this.lineByIndex = new Map();
    this.targets = new Set();
    this.ghosts = [];
    this.cursor = { r: 0, c: 0 };
    this.facing = { dr: 0, dc: 1 };
    this.blockedUntil = 0;
    this.hp = 3;
    this.maxHp = 3;
    this.invulnerableUntil = 0;
    this.hitFlashUntil = 0;
    this.lastGhostStep = null;
    this.gameOver = false;
    this.bombPickups = new Set();
    this.heldBomb = false;
    this.activeBombs = [];
    this.explosions = [];
    this.blocks = new Set();
  }

  start({ cols, rows, stage = this.stage, seed } = {}) {
    if (!Number.isInteger(cols) || cols < 3) {
      throw new RangeError("cols must be an integer >= 3");
    }
    if (!Number.isInteger(rows) || rows < 3) {
      throw new RangeError("rows must be an integer >= 3");
    }

    this.cols = cols;
    this.rows = rows;
    this.stage = Math.max(1, stage);
    this.seed = seed == null ? this.seedFn() : seed;
    this.moves = 0;
    this.blockedUntil = 0;

    const rand = mulberry32(this.seed);
    const desired = Math.min(
      MAX_PATH,
      Math.max(90, Math.floor(cols * rows * 0.06) + this.stage * 18)
    );

    this.path = generatePath({ cols, rows, targetLen: desired, rand });
    this.pathSet = new Set(this.path.map((p) => cellKey(p.r, p.c)));
    this.buildLines();

    const targetCount = Math.min(
      MAX_TARGETS,
      3 + Math.floor((this.stage - 1) / 2)
    );
    this.targets = placeTargets({ path: this.path, count: targetCount, rand });
    this.cursor = { r: this.path[0].r, c: this.path[0].c };
    this.facing = this.path.length > 1
      ? {
          dr: Math.sign(this.path[1].r - this.path[0].r),
          dc: Math.sign(this.path[1].c - this.path[0].c)
        }
      : { dr: 0, dc: 1 };
    this.hp = this.maxHp;
    this.invulnerableUntil = 0;
    this.hitFlashUntil = 0;
    this.lastGhostStep = null;
    this.gameOver = false;
    this.ghosts = this.spawnGhosts(rand);
    this.heldBomb = false;
    this.activeBombs = [];
    this.explosions = [];
    this.bombPickups = this.spawnBombs(rand);
    this.blocks = this.spawnBlocks(rand);

    return this;
  }

  spawnBlocks(rand) {
    const count = 3 + Math.floor(rand() * 3);
    const blocks = new Set();
    const ghostIndices = new Set(this.ghosts.map((ghost) => ghost.index));

    for (let i = 0; i < count; i += 1) {
      let guard = 0;

      while (guard < 250) {
        guard += 1;
        const index = 1 + Math.floor(rand() * Math.max(1, this.path.length - 1));
        if (index <= 4 || ghostIndices.has(index)) continue;
        const key = cellKey(this.path[index].r, this.path[index].c);
        if (
          this.targets.has(key) ||
          this.bombPickups.has(key) ||
          blocks.has(key)
        ) {
          continue;
        }
        blocks.add(key);
        break;
      }
    }

    return blocks;
  }

  spawnBombs(rand) {
    const count = Math.min(2, 1 + Math.floor((this.stage - 1) / 3));
    const bombs = new Set();

    for (let i = 0; i < count; i += 1) {
      let guard = 0;

      while (guard < 200) {
        guard += 1;
        const index = 1 + Math.floor(rand() * Math.max(1, this.path.length - 1));
        if (index <= 4) continue;
        const key = cellKey(this.path[index].r, this.path[index].c);
        if (this.targets.has(key) || bombs.has(key)) continue;
        bombs.add(key);
        break;
      }
    }

    return bombs;
  }

  spawnGhosts(rand) {
    const count = Math.min(MAX_GHOSTS, 1 + this.stage);
    const ghosts = [];
    const used = new Set();
    const minIndex = Math.min(6, Math.max(1, Math.floor(this.path.length * 0.12)));

    for (let i = 0; i < count; i += 1) {
      let index = minIndex;
      let guard = 0;

      do {
        index = minIndex + Math.floor(rand() * Math.max(1, this.path.length - minIndex));
        guard += 1;
      } while (used.has(index) && guard < 100);

      used.add(index);
      ghosts.push({ index, dir: i % 2 === 0 ? 1 : -1 });
    }

    return ghosts;
  }

  restartPath() {
    return this.start({ cols: this.cols, rows: this.rows, stage: this.stage });
  }

  advanceStage() {
    return this.start({
      cols: this.cols,
      rows: this.rows,
      stage: this.stage + 1
    });
  }

  pathIndex(cell = this.cursor) {
    return this.path.findIndex((p) => p.r === cell.r && p.c === cell.c);
  }

  ghostAt(index) {
    return this.ghosts.find((ghost) => ghost.index === index) || null;
  }

  ghostAtCell(cell) {
    const index = this.pathIndex(cell);
    return index === -1 ? null : this.ghostAt(index);
  }

  update(now = this.now()) {
    this.explodeBombs(now);

    if (this.gameOver) return;

    if (this.lastGhostStep === null) {
      this.lastGhostStep = now;
      return;
    }

    const elapsed = now - this.lastGhostStep;
    if (elapsed < this.ghostStepMs) return;

    let steps = Math.floor(elapsed / this.ghostStepMs);
    this.lastGhostStep = now;

    if (steps > 4) steps = 4;

    for (let step = 0; step < steps && !this.gameOver; step += 1) {
      this.tickGhosts(now);
    }
  }

  tickGhosts(now) {
    const playerIndex = this.pathIndex();
    if (playerIndex === -1) return;

    for (const ghost of this.ghosts) {
      let next = ghost.index + ghost.dir;

      if (next < 1 || next >= this.path.length) {
        ghost.dir *= -1;
        next = ghost.index + ghost.dir;
      }

      if (next >= 1 && next < this.path.length) {
        ghost.index = next;
      }

      if (ghost.index === playerIndex) {
        this.hit(now);
        if (this.gameOver) return;
      }
    }
  }

  hit(now = this.now()) {
    if (this.gameOver) return false;
    if (now < this.invulnerableUntil) return false;

    this.hp -= 1;
    this.hitFlashUntil = now + 250;
    this.invulnerableUntil = now + HIT_INVULN_MS;
    this.cursor = { r: this.path[0].r, c: this.path[0].c };

    if (this.hp <= 0) {
      this.hp = 0;
      this.gameOver = true;
    }

    return true;
  }

  stepAlongPath(direction, now = this.now()) {
    this.moves += 1;
    const dir = direction > 0 ? 1 : -1;

    let distance = 0;
    for (let step = 1; step <= JUMP_DISTANCE; step += 1) {
      const cell = {
        r: this.cursor.r + this.facing.dr * step * dir,
        c: this.cursor.c + this.facing.dc * step * dir
      };
      if (!this.pathSet.has(cellKey(cell.r, cell.c))) break;
      distance = step;
    }

    if (distance === 0) {
      this.blockedUntil = now + BLOCK_FLASH_MS;
      return { moved: false, blocked: true };
    }

    for (let step = 1; step <= distance; step += 1) {
      const cell = {
        r: this.cursor.r + this.facing.dr * step * dir,
        c: this.cursor.c + this.facing.dc * step * dir
      };
      if (this.blocks.has(cellKey(cell.r, cell.c))) {
        this.blockedUntil = now + BLOCK_FLASH_MS;
        return { moved: false, blocked: true };
      }
    }

    const landing = {
      r: this.cursor.r + this.facing.dr * distance * dir,
      c: this.cursor.c + this.facing.dc * distance * dir
    };

    if (this.ghostAtCell(landing)) {
      this.blockedUntil = now + BLOCK_FLASH_MS;
      return { moved: false, blocked: true };
    }

    let ghostsJumped = 0;
    for (let step = 1; step < distance; step += 1) {
      const cell = {
        r: this.cursor.r + this.facing.dr * step * dir,
        c: this.cursor.c + this.facing.dc * step * dir
      };
      const index = this.pathIndex(cell);
      if (index !== -1 && this.ghostAt(index)) ghostsJumped += 1;
    }

    this.cursor = landing;

    return {
      moved: true,
      blocked: false,
      jumped: true,
      ghostsJumped,
      distance
    };
  }

  buildLines() {
    this.lines = [];
    this.lineByIndex = new Map();

    if (!this.path.length) return;

    let start = 0;
    let dir = null;

    for (let i = 1; i < this.path.length; i += 1) {
      const step = {
        dr: Math.sign(this.path[i].r - this.path[i - 1].r),
        dc: Math.sign(this.path[i].c - this.path[i - 1].c)
      };

      if (dir === null) {
        dir = step;
        continue;
      }

      if (step.dr !== dir.dr || step.dc !== dir.dc) {
        this.addLine(start, i - 1, dir);
        start = i;
        dir = step;
      }
    }

    this.addLine(start, this.path.length - 1, dir || { dr: 0, dc: 1 });
  }

  addLine(start, end, dir) {
    const cells = [];

    for (let i = start; i <= end; i += 1) {
      cells.push({ ...this.path[i], index: i });
    }

    const horizontal = dir.dc !== 0;
    let startCell = cells[0];
    let endCell = cells[0];

    for (const cell of cells) {
      if (horizontal) {
        if (cell.c < startCell.c) startCell = cell;
        if (cell.c > endCell.c) endCell = cell;
      } else {
        if (cell.r < startCell.r) startCell = cell;
        if (cell.r > endCell.r) endCell = cell;
      }
    }

    const line = {
      indexes: cells.map((cell) => cell.index),
      orientation: horizontal ? "h" : "v",
      start: { r: startCell.r, c: startCell.c },
      end: { r: endCell.r, c: endCell.c }
    };

    this.lines.push(line);
    for (const cell of cells) {
      this.lineByIndex.set(cell.index, line);
    }
  }

  jumpToLineBoundary(target, now = this.now()) {
    this.moves += 1;
    const index = this.pathIndex();

    if (index === -1) {
      return { moved: false, blocked: true };
    }

    const line = this.lineByIndex.get(index);
    if (!line) {
      return { moved: false, blocked: true };
    }

    const cell = target === "start" ? line.start : line.end;
    const targetIndex = this.pathIndex(cell);

    if (targetIndex === -1) {
      return { moved: false, blocked: true, line: target };
    }

    const from = Math.min(index, targetIndex);
    const to = Math.max(index, targetIndex);

    for (let i = from; i <= to; i += 1) {
      const pathCell = this.path[i];
      if (this.blocks.has(cellKey(pathCell.r, pathCell.c))) {
        this.blockedUntil = now + BLOCK_FLASH_MS;
        return { moved: false, blocked: true, line: target };
      }
    }

    this.cursor = { r: cell.r, c: cell.c };

    if (this.ghostAtCell(cell)) {
      this.hit(now);
      return { moved: true, blocked: false, line: target, hit: true };
    }

    return { moved: true, blocked: false, line: target, hit: false };
  }

  pickUpBomb(now = this.now()) {
    this.moves += 1;

    if (this.heldBomb) {
      return { picked: false, reason: "holding" };
    }

    const key = cellKey(this.cursor.r, this.cursor.c);
    if (!this.bombPickups.has(key)) {
      return { picked: false, reason: "none" };
    }

    this.bombPickups.delete(key);
    this.heldBomb = true;
    return { picked: true };
  }

  placeBomb(direction, now = this.now()) {
    this.moves += 1;

    if (!this.heldBomb) {
      return { placed: false, reason: "empty" };
    }

    const index = this.pathIndex();
    const target = index + direction;

    if (target < 0 || target >= this.path.length) {
      return { placed: false, reason: "edge" };
    }

    const cell = this.path[target];
    const key = cellKey(cell.r, cell.c);

    if (this.bombPickups.has(key)) {
      return { placed: false, reason: "occupied" };
    }

    if (this.blocks.has(key)) {
      return { placed: false, reason: "occupied" };
    }

    if (this.activeBombs.some((bomb) => bomb.r === cell.r && bomb.c === cell.c)) {
      return { placed: false, reason: "occupied" };
    }

    this.activeBombs.push({ r: cell.r, c: cell.c, placedAt: now });
    this.heldBomb = false;
    return { placed: true, cell };
  }

  explodeBombs(now = this.now()) {
    const exploded = [];

    this.activeBombs = this.activeBombs.filter((bomb) => {
      if (now - bomb.placedAt >= BOMB_FUSE_MS) {
        exploded.push(bomb);
        return false;
      }
      return true;
    });

    for (const bomb of exploded) {
      const before = this.ghosts.length;

      this.ghosts = this.ghosts.filter((ghost) => {
        const cell = this.path[ghost.index];
        const dr = cell.r - bomb.r;
        const dc = cell.c - bomb.c;
        return Math.sqrt(dr * dr + dc * dc) > BOMB_RADIUS;
      });

      this.explosions.push({
        r: bomb.r,
        c: bomb.c,
        startedAt: now,
        kills: before - this.ghosts.length
      });
    }

    this.explosions = this.explosions.filter(
      (explosion) => now - explosion.startedAt < EXPLOSION_MS
    );
  }

  removeBlock(now = this.now()) {
    this.moves += 1;
    const front = {
      r: this.cursor.r + this.facing.dr,
      c: this.cursor.c + this.facing.dc
    };
    const key = cellKey(front.r, front.c);

    if (!this.blocks.has(key)) {
      return { removed: false, reason: "none" };
    }

    this.blocks.delete(key);
    return { removed: true, cell: front, remaining: this.blocks.size };
  }

  move(dr, dc, now = this.now()) {
    this.moves += 1;
    this.facing = { dr, dc };
    const next = { r: this.cursor.r + dr, c: this.cursor.c + dc };

    if (!this.pathSet.has(cellKey(next.r, next.c))) {
      this.blockedUntil = now + BLOCK_FLASH_MS;
      return { moved: false, blocked: true };
    }

    if (this.blocks.has(cellKey(next.r, next.c))) {
      this.blockedUntil = now + BLOCK_FLASH_MS;
      return { moved: false, blocked: true };
    }

    this.cursor = next;
    const ghostHere = this.ghostAt(this.pathIndex());

    if (ghostHere) {
      this.hit(now);
      return { moved: true, blocked: false, hit: true };
    }

    return { moved: true, blocked: false, hit: false };
  }

  deleteAtCursor(now = this.now()) {
    this.moves += 1;
    const key = cellKey(this.cursor.r, this.cursor.c);
    if (!this.targets.has(key)) return false;
    this.targets.delete(key);
    this.blockedUntil = Math.min(this.blockedUntil, now);
    return true;
  }

  isComplete() {
    return this.targets.size === 0;
  }

  snapshot(now = this.now()) {
    const cursorIndex = this.pathIndex();
    const currentLine = cursorIndex === -1
      ? null
      : this.lineByIndex.get(cursorIndex);

    return {
      cols: this.cols,
      rows: this.rows,
      stage: this.stage,
      seed: this.seed,
      moves: this.moves,
      path: this.path,
      pathSet: this.pathSet,
      targets: new Set(this.targets),
      ghosts: this.ghosts.map((ghost) => ({
        index: ghost.index,
        dir: ghost.dir,
        ...this.path[ghost.index]
      })),
      bombPickups: Array.from(this.bombPickups).map((key) => {
        const [r, c] = key.split(":").map(Number);
        return { r, c };
      }),
      heldBomb: this.heldBomb,
      activeBombs: this.activeBombs.map((bomb) => ({
        r: bomb.r,
        c: bomb.c,
        remainingMs: Math.max(0, BOMB_FUSE_MS - (now - bomb.placedAt))
      })),
      explosions: this.explosions.map((explosion) => ({
        r: explosion.r,
        c: explosion.c,
        age: now - explosion.startedAt,
        kills: explosion.kills
      })),
      bombFuseMs: BOMB_FUSE_MS,
      bombRadius: BOMB_RADIUS,
      blocks: Array.from(this.blocks).map((key) => {
        const [r, c] = key.split(":").map(Number);
        return { r, c };
      }),
      cursor: { ...this.cursor },
      facing: { ...this.facing },
      lineMarks: currentLine
        ? {
            start: { ...currentLine.start },
            end: { ...currentLine.end }
          }
        : null,
      remaining: this.targets.size,
      complete: this.isComplete(),
      blocked: now < this.blockedUntil,
      blockedUntil: this.blockedUntil,
      hp: this.hp,
      maxHp: this.maxHp,
      gameOver: this.gameOver,
      invulnerable: now < this.invulnerableUntil,
      hitFlash: now < this.hitFlashUntil,
      ghostStepMs: this.ghostStepMs
    };
  }
}
