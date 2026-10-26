export function computeGrid(width, height) {
  const availW = width - 32;
  const availH = height - 120;

  let cw = 10;
  let ch = 18;

  if (availW > 1100) {
    cw = 14;
    ch = 24;
  } else if (availW > 700) {
    cw = 12;
    ch = 21;
  }

  const cols = Math.max(24, Math.floor(availW / cw));
  const rows = Math.max(14, Math.floor(availH / ch));

  return { cols, rows, cw, ch };
}
