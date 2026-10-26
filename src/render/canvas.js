import { BLOCK_FLASH_MS, EXPLOSION_MS } from "../core/game.js";
import { cellKey, parseCellKey } from "../core/path.js";

const COLORS = {
  path: "#5c554c",
  target: "#fe8019",
  targetGlow: "rgba(254, 128, 25, 0.85)",
  cursor: "#ebdbb2",
  cursorGlow: "rgba(250, 189, 47, 0.5)",
  blocked: "#fb4934",
  blockedGlow: "rgba(251, 73, 52, 0.85)",
  glyph: "#1d2021"
};

const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const PACMAN_OPEN = [
  "00001111000",
  "00011111100",
  "00111111110",
  "01111001111",
  "11110000111",
  "11100000011",
  "11110000111",
  "01111001111",
  "00111111110",
  "00011111100",
  "00001111000"
];

const PACMAN_CLOSED = [
  "00001111000",
  "00011111100",
  "00111111110",
  "01111111111",
  "11111111111",
  "11111111111",
  "11111111111",
  "01111111111",
  "00111111110",
  "00011111100",
  "00001111000"
];

const BLOCK_PIXELS = [
  "#########",
  "#.......#",
  "#.x...x.#",
  "#..x.x..#",
  "#...x...#",
  "#..x.x..#",
  "#.x...x.#",
  "#.......#",
  "#########"
];

const BOMB_PIXELS = [
  "......*..",
  ".....*...",
  "..#####..",
  ".#######.",
  "#########",
  "#########",
  "#########",
  ".#######.",
  "..#####.."
];

function drawBomb(ctx, centerX, centerY, size, active, now, remainingMs) {
  const rows = BOMB_PIXELS.length;
  const pixel = size / rows;
  const startX = centerX - (BOMB_PIXELS[0].length * pixel) / 2;
  const startY = centerY - (rows * pixel) / 2;
  const blink = active && remainingMs < 1200 && Math.floor(now / 120) % 2 === 0;

  ctx.save();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < BOMB_PIXELS[row].length; col += 1) {
      const value = BOMB_PIXELS[row][col];
      if (value === ".") continue;
      if (value === "*") {
        ctx.fillStyle = blink ? "#fb4934" : "#fe8019";
        ctx.shadowColor = blink ? "#fb4934" : "#fe8019";
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = active ? "#504945" : "#3c3836";
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(
        startX + col * pixel,
        startY + row * pixel,
        pixel + 0.5,
        pixel + 0.5
      );
    }
  }
  ctx.restore();
}

function drawBlock(ctx, centerX, centerY, size) {
  const rows = BLOCK_PIXELS.length;
  const pixel = size / rows;
  const startX = centerX - (BLOCK_PIXELS[0].length * pixel) / 2;
  const startY = centerY - (rows * pixel) / 2;

  ctx.save();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < BLOCK_PIXELS[row].length; col += 1) {
      const value = BLOCK_PIXELS[row][col];
      if (value === ".") {
        ctx.fillStyle = "#3c3836";
        ctx.shadowBlur = 0;
      } else if (value === "x") {
        ctx.fillStyle = "#fabd2f";
        ctx.shadowColor = "rgba(250, 189, 47, 0.7)";
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "#fe8019";
        ctx.shadowColor = "rgba(254, 128, 25, 0.6)";
        ctx.shadowBlur = 6;
      }
      ctx.fillRect(
        startX + col * pixel,
        startY + row * pixel,
        pixel + 0.5,
        pixel + 0.5
      );
    }
  }
  ctx.restore();
}

function drawPacman(ctx, centerX, centerY, size, dir, open) {
  const pattern = open ? PACMAN_OPEN : PACMAN_CLOSED;
  const rows = pattern.length;
  const pixel = size / rows;
  const startX = centerX - (pattern[0].length * pixel) / 2;
  const startY = centerY - (rows * pixel) / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.translate(-centerX, -centerY);
  ctx.fillStyle = "#fabd2f";
  ctx.shadowColor = "rgba(250, 189, 47, 0.8)";
  ctx.shadowBlur = 8;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < pattern[row].length; col += 1) {
      if (pattern[row][col] === "1") {
        ctx.fillRect(
          startX + col * pixel,
          startY + row * pixel,
          pixel + 0.5,
          pixel + 0.5
        );
      }
    }
  }

  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }

  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.layout = { cols: 0, rows: 0, cw: 14, ch: 24 };
    this.boundaryKeys = { start: "I", end: "A" };
    this.hintsEnabled = true;
  }

  setLayout(layout) {
    this.layout = layout;
  }

  setBoundaryKeys(keys) {
    this.boundaryKeys = { ...keys };
  }

  setHints(enabled) {
    this.hintsEnabled = enabled;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;

    this.dpr = dpr;
    this.width = width;
    this.height = height;
  }

  render(state, now) {
    const { ctx } = this;
    const { cols, rows, cw, ch } = this.layout;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (!cols || !rows) return;

    const ox = (this.width - cols * cw) / 2;
    const oy = (this.height - rows * ch) / 2;
    const fontSize = Math.round(ch * 0.62);

    ctx.fillStyle = COLORS.path;
    const dotRadius = Math.max(1, cw * 0.09);
    for (const cell of state.path) {
      const x = ox + cell.c * cw + cw / 2;
      const y = oy + cell.r * ch + ch / 2;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `${fontSize}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let index = 0;
    for (const key of state.targets) {
      const { r, c } = parseCellKey(key);
      const x = ox + c * cw + cw / 2;
      const y = oy + r * ch + ch / 2;
      const pulse = (Math.sin(now / 240 + index * 0.8) + 1) / 2;

      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.fillStyle = COLORS.target;
      ctx.shadowColor = COLORS.targetGlow;
      ctx.shadowBlur = 8 + 12 * pulse;
      ctx.fillText("o", x, y + 1);
      ctx.restore();

      index += 1;
    }

    const bombSize = Math.min(cw, ch) * 0.9;

    for (const bomb of state.bombPickups) {
      const x = ox + bomb.c * cw + cw / 2;
      const y = oy + bomb.r * ch + ch / 2;
      drawBomb(ctx, x, y, bombSize, false, now, 0);
    }

    for (const bomb of state.activeBombs) {
      const x = ox + bomb.c * cw + cw / 2;
      const y = oy + bomb.r * ch + ch / 2;
      drawBomb(ctx, x, y, bombSize, true, now, bomb.remainingMs);

      ctx.save();
      ctx.fillStyle = bomb.remainingMs < 1200 ? "#fb4934" : "#fabd2f";
      ctx.font = `${Math.round(ch * 0.42)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        String(Math.ceil(bomb.remainingMs / 1000)),
        x,
        y - ch * 0.62
      );
      ctx.restore();
    }

    const blockSize = Math.min(cw, ch) * 0.9;

    for (const block of state.blocks) {
      const x = ox + block.c * cw + cw / 2;
      const y = oy + block.r * ch + ch / 2;
      drawBlock(ctx, x, y, blockSize);
    }

    const mouthOpen = Math.floor(now / 160) % 2 === 0;
    for (const ghost of state.ghosts) {
      const x = ox + ghost.c * cw + cw / 2;
      const y = oy + ghost.r * ch + ch / 2;
      drawPacman(
        ctx,
        x,
        y,
        Math.min(cw, ch) * 0.92,
        ghost.dir,
        mouthOpen
      );
    }

    if (state.hitFlash) {
      ctx.save();
      ctx.fillStyle = "rgba(251, 73, 52, 0.12)";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    for (const explosion of state.explosions) {
      const t = Math.min(1, explosion.age / EXPLOSION_MS);
      const x = ox + explosion.c * cw + cw / 2;
      const y = oy + explosion.r * ch + ch / 2;
      const radius = state.bombRadius * t;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(cw, ch);
      ctx.globalAlpha = (1 - t) * 0.45;
      ctx.fillStyle = "#fe8019";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = "#fabd2f";
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (state.heldBomb) {
      this.drawPlaceHints(state, ox, oy);
    }

    this.drawCursor(state, now, ox, oy, fontSize);
    this.drawLineMarkers(state, ox, oy);
    this.drawContextHints(state, ox, oy);
  }

  drawContextHints(state, ox, oy) {
    if (!this.hintsEnabled) return;

    const { ctx } = this;
    const { cw, ch } = this.layout;
    const cursorKey = cellKey(state.cursor.r, state.cursor.c);
    const front = {
      r: state.cursor.r + state.facing.dr,
      c: state.cursor.c + state.facing.dc
    };
    const hints = [];

    if (state.targets.has(cursorKey)) {
      hints.push({ cell: state.cursor, label: "x", color: "#fe8019" });
    }

    if (
      state.blocks.some(
        (block) => block.r === front.r && block.c === front.c
      )
    ) {
      hints.push({ cell: front, label: "dd", color: "#fb4934" });
    }

    if (
      state.bombPickups.some(
        (bomb) =>
          bomb.r === state.cursor.r && bomb.c === state.cursor.c
      )
    ) {
      hints.push({ cell: state.cursor, label: "yy", color: "#d3869b" });
    }

    for (const hint of hints) {
      const cx = ox + hint.cell.c * cw + cw / 2;
      const cy = oy + hint.cell.r * ch + ch / 2;
      const badgeX = cx + cw * 0.5;
      const badgeY = cy - ch * 0.4;
      const badgeWidth = Math.max(
        16,
        hint.label.length * Math.round(ch * 0.3) + 10
      );

      ctx.save();
      ctx.fillStyle = "rgba(20, 22, 23, 0.9)";
      ctx.strokeStyle = hint.color;
      ctx.lineWidth = 1;
      roundedRect(
        ctx,
        badgeX - badgeWidth / 2,
        badgeY - 8,
        badgeWidth,
        16,
        4
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hint.color;
      ctx.font = `${Math.round(ch * 0.4)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hint.label, badgeX, badgeY + 1);
      ctx.restore();
    }
  }

  drawLineMarkers(state, ox, oy) {
    if (!state.lineMarks) return;

    const { ctx } = this;
    const { cw, ch } = this.layout;
    const { start, end } = state.lineMarks;
    const blocked = new Set(
      state.blocks.map((block) => `${block.r}:${block.c}`)
    );
    const same = start.r === end.r && start.c === end.c;
    const items = same
      ? [
          {
            cell: start,
            label: `${this.boundaryKeys.start}/${this.boundaryKeys.end}`,
            color: "#fabd2f",
            blocked: blocked.has(`${start.r}:${start.c}`)
          }
        ]
      : [
          {
            cell: start,
            label: this.boundaryKeys.start,
            color: "#83a598",
            blocked: blocked.has(`${start.r}:${start.c}`)
          },
          {
            cell: end,
            label: this.boundaryKeys.end,
            color: "#fe8019",
            blocked: blocked.has(`${end.r}:${end.c}`)
          }
        ];

    for (const item of items) {
      const cx = ox + item.cell.c * cw + cw / 2;
      const cy = oy + item.cell.r * ch + ch / 2;
      const color = item.blocked ? "#fb4934" : item.color;

      ctx.save();
      ctx.globalAlpha = this.hintsEnabled ? 0.35 : 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cw, ch) * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (!this.hintsEnabled) continue;

      const badgeHeight = 16;
      const badgeWidth = Math.max(
        16,
        item.label.length * Math.round(ch * 0.3) + 10
      );
      let badgeY = cy - ch * 0.7;
      if (badgeY - badgeHeight / 2 < 4) badgeY = cy + ch * 0.7;

      ctx.save();
      ctx.fillStyle = "rgba(20, 22, 23, 0.9)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      roundedRect(
        ctx,
        cx - badgeWidth / 2,
        badgeY - badgeHeight / 2,
        badgeWidth,
        badgeHeight,
        4
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `${Math.round(ch * 0.4)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, cx, badgeY + 1);
      ctx.restore();
    }
  }

  drawPlaceHints(state, ox, oy) {
    const { ctx } = this;
    const { cw, ch } = this.layout;
    const index = state.path.findIndex(
      (cell) => cell.r === state.cursor.r && cell.c === state.cursor.c
    );

    if (index === -1) return;

    const hints = [];
    if (index + 1 < state.path.length) {
      hints.push({ cell: state.path[index + 1], key: "p" });
    }
    if (index - 1 >= 0) {
      hints.push({ cell: state.path[index - 1], key: "P" });
    }

    for (const hint of hints) {
      const x = ox + hint.cell.c * cw + cw * 0.76;
      const y = oy + hint.cell.r * ch + ch * 0.22;

      ctx.save();
      ctx.fillStyle = "rgba(20, 22, 23, 0.88)";
      ctx.strokeStyle = "#fe8019";
      ctx.lineWidth = 1;
      roundedRect(ctx, x - 9, y - 9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fe8019";
      ctx.font = `${Math.round(ch * 0.46)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hint.key, x, y + 1);
      ctx.restore();
    }
  }

  drawCursor(state, now, ox, oy, fontSize) {
    const { ctx } = this;
    const { cw, ch } = this.layout;
    const { cursor } = state;
    const blocked = state.blocked;
    const cx = ox + cursor.c * cw;
    const cy = oy + cursor.r * ch;

    let scale = 1;
    if (blocked) {
      const elapsed = BLOCK_FLASH_MS - Math.max(0, state.blockedUntil - now);
      const t = Math.max(0, Math.min(1, elapsed / BLOCK_FLASH_MS));
      scale = 1 - 0.18 * Math.sin(Math.PI * t);
    }

    ctx.save();
    if (state.invulnerable && Math.floor(now / 120) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }
    ctx.translate(cx + cw / 2, cy + ch / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = blocked ? COLORS.blocked : COLORS.cursor;
    ctx.shadowColor = blocked ? COLORS.blockedGlow : COLORS.cursorGlow;
    ctx.shadowBlur = blocked ? 22 : 14;
    roundedRect(ctx, -cw / 2 + 1, -ch / 2 + 1, cw - 2, ch - 2, 3);
    ctx.fill();
    ctx.restore();

    const under = cellKey(cursor.r, cursor.c);
    let glyph = "";
    if (state.targets.has(under)) glyph = "o";
    else if (state.pathSet.has(under)) glyph = "·";

    if (glyph) {
      ctx.save();
      ctx.fillStyle = COLORS.glyph;
      ctx.font = `${fontSize}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph, cx + cw / 2, cy + ch / 2 + 1);
      ctx.restore();
    }

    if (state.heldBomb) {
      drawBomb(
        ctx,
        cx + cw / 2,
        cy - ch * 0.8,
        Math.min(cw, ch) * 0.5,
        false,
        now,
        0
      );
    }
  }
}
