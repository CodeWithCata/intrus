/**
 * Minimal QR Code encoder (ISO 18004): byte mode, error correction level M, versions 1-9 (up to 180 bytes),
 * all 8 masks scored and the best one used. No dependencies. Enough for a room link such as
 * "https://intrus.netlify.app/online/ABCDEF".
 */

/* [ecCodewordsPerBlock, blocks in group 1, data codewords per block in group 1, blocks in group 2, data per block in group 2], level M */
const M_TABLE: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0], //  1
  [16, 1, 28, 0, 0], //  2
  [26, 1, 44, 0, 0], //  3
  [18, 2, 32, 0, 0], //  4
  [24, 2, 43, 0, 0], //  5
  [16, 4, 27, 0, 0], //  6
  [18, 4, 31, 0, 0], //  7
  [22, 2, 38, 2, 39], //  8
  [22, 3, 36, 2, 37], //  9
  [26, 4, 43, 1, 44] // 10
];
const ALIGN: readonly (readonly number[])[] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const dataCapacity = (v: number): number => {
  const [, b1, d1, b2, d2] = M_TABLE[v - 1];
  return b1 * d1 + b2 * d2;
};

/* ---- Reed-Solomon over GF(256), polynomial 0x11D ---- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsRemainder(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

/* ---- bits ---- */
function toBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function buildCodewords(bytes: number[], version: number): number[] {
  const cap = dataCapacity(version);
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // character count (8 bits for versions 1-9)
  for (const b of bytes) push(b, 8);
  const totalBits = cap * 8;
  push(0, Math.min(4, totalBits - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLen, b1, d1, b2, d2] = M_TABLE[version - 1];
  const blocks: { data: number[]; ec: number[] }[] = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const size = i < b1 ? d1 : d2;
    const chunk = data.slice(pos, pos + size);
    pos += size;
    blocks.push({ data: chunk, ec: rsRemainder(chunk, ecLen) });
  }
  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

/* ---- matrix ---- */
type Grid = boolean[][];

function emptyGrids(size: number): { modules: Grid; reserved: Grid } {
  const make = (): Grid => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { modules: make(), reserved: make() };
}

function drawFunctionPatterns(modules: Grid, reserved: Grid, version: number): void {
  const size = modules.length;
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  for (let i = 0; i < size; i++) {
    if (!reserved[6][i]) set(i, 6, i % 2 === 0);
    if (!reserved[i][6]) set(6, i, i % 2 === 0);
  }
  const pos = ALIGN[version - 1];
  for (const cy of pos) {
    for (const cx of pos) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // format areas (reserved now, filled after the mask is chosen) and the always-dark module
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue; // (8,6) and (6,8) belong to the timing pattern
    set(8, i, false);
    set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, false);
    set(8, size - 1 - i, false);
  }
  set(8, size - 8, true);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
}

function placeData(modules: Grid, reserved: Grid, codewords: number[]): void {
  const size = modules.length;
  const bits: boolean[] = [];
  for (const c of codewords) for (let i = 7; i >= 0; i--) bits.push(((c >>> i) & 1) === 1);
  let k = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let n = 0; n < size; n++) {
      const y = upward ? size - 1 - n : n;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!reserved[y][x]) modules[y][x] = k < bits.length ? bits[k++] : false;
      }
    }
    upward = !upward;
  }
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

function applyMask(modules: Grid, reserved: Grid, mask: number): Grid {
  return modules.map((row, y) => row.map((v, x) => (reserved[y][x] ? v : v !== MASKS[mask](x, y))));
}

/** Format information for level M (bits 00) and the given mask, BCH(15,5) with the 0x5412 mask. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(modules: Grid, mask: number): void {
  const size = modules.length;
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = bit(i);
  modules[size - 8][8] = true;
}

function penalty(m: Grid): number {
  const size = m.length;
  let score = 0;
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  runs((i, j) => m[i][j]);
  runs((i, j) => m[j][i]);
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  const pat = [true, false, true, true, true, false, true, false, false, false, false];
  const rev = [...pat].reverse();
  const matches = (get: (k: number) => boolean, p: boolean[], at: number) => p.every((v, k) => get(at + k) === v);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 11; j++) {
      if (matches((k) => m[i][k], pat, j) || matches((k) => m[i][k], rev, j)) score += 40;
      if (matches((k) => m[k][i], pat, j) || matches((k) => m[k][i], rev, j)) score += 40;
    }
  }
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/** The QR matrix for `text` (true = dark module). Throws if the text does not fit in version 10. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = toBytes(text);
  let version = 1;
  // 4-bit mode + 8-bit count (versions 1-9; version 10 would need a 16-bit count, so it is not used)
  while (version <= 9 && Math.ceil((4 + 8 + bytes.length * 8) / 8) > dataCapacity(version)) version++;
  if (version > 9) throw new Error("QR text too long (max 180 bytes at version 9)");
  const size = 17 + 4 * version;
  const { modules, reserved } = emptyGrids(size);
  drawFunctionPatterns(modules, reserved, version);
  placeData(modules, reserved, buildCodewords(bytes, version));
  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(modules, reserved, mask);
    drawFormat(candidate, mask);
    const s = penalty(candidate);
    if (s < bestScore) {
      bestScore = s;
      best = candidate;
    }
  }
  return best as Grid;
}

/** SVG path data: one 1x1 square per dark module, in module units, plus the size. */
export function qrPath(text: string): { d: string; size: number } {
  const m = qrMatrix(text);
  let d = "";
  for (let y = 0; y < m.length; y++) {
    let x = 0;
    while (x < m.length) {
      if (!m[y][x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < m.length && m[y][end]) end++;
      d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  }
  return { d, size: m.length };
}
