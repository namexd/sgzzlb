import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = join(__dirname, "..", "images", "icons");
mkdirSync(ICON_DIR, { recursive: true });

// Minimal PNG encoder (no dependencies)
function createPng(width, height, rgba) {
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT - raw pixel data with Adler32
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const rawData = Buffer.from(raw);

  // Adler32
  let a = 1, b = 0;
  for (let i = 0; i < rawData.length; i++) {
    a = (a + rawData[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;

  // deflate stored (no compression)
  const blocks = [];
  let pos = 0;
  while (pos < rawData.length) {
    const remaining = rawData.length - pos;
    const blockLen = Math.min(remaining, 65535);
    const isFinal = (pos + blockLen >= rawData.length);
    const header = Buffer.alloc(5);
    header[0] = isFinal ? 1 : 0;
    header.writeUInt16LE(blockLen, 1);
    header.writeUInt16LE(blockLen ^ 0xffff, 3);
    blocks.push(header, rawData.slice(pos, pos + blockLen));
    pos += blockLen;
  }
  const deflateData = Buffer.concat([...blocks, Buffer.from([
    adler >>> 24, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff
  ])]);

  // zlib wrapper (CMF=0x78, FLG=0x01)
  const zlib = Buffer.concat([Buffer.from([0x78, 0x01]), deflateData]);

  const idat = chunk("IDAT", zlib);

  // IEND
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, chunk("IHDR", ihdr), idat, iend]);
}

// --- Icon drawing helpers ---

function makeRgba(w, h, bg = [0, 0, 0, 0]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  return data;
}

function setPixel(data, w, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const i = (y * w + x) * 4;
  data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
}

function drawCircle(data, w, cx, cy, radius, r, g, b, filled = true) {
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (filled ? dist <= radius : (dist <= radius && dist >= radius - 2)) {
        setPixel(data, w, x, y, r, g, b);
      }
    }
  }
}

function drawRect(data, w, x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(data, w, x, y, r, g, b);
    }
  }
}

function drawLine(data, w, x1, y1, x2, y2, r, g, b, thickness = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const x = Math.round(x1 + dx * t);
    const y = Math.round(y1 + dy * t);
    for (let tx = -thickness / 2; tx <= thickness / 2; tx++) {
      for (let ty = -thickness / 2; ty <= thickness / 2; ty++) {
        setPixel(data, w, Math.round(x + tx), Math.round(y + ty), r, g, b);
      }
    }
  }
}

function drawDiamond(data, w, cx, cy, size, r, g, b) {
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      if (dx + dy <= size) setPixel(data, w, x, y, r, g, b);
    }
  }
}

// --- Generate each icon ---

const SIZE = 81;
const GOLD = [214, 168, 93];
const DIM = [141, 151, 165];

function saveIcon(name, rgba) {
  const path = join(ICON_DIR, `${name}.png`);
  writeFileSync(path, createPng(SIZE, SIZE, rgba));
  console.log(`✓ ${name}.png`);
}

// 1. 评分 (analyze) - star/diamond shape
function makeAnalyze(color) {
  const d = makeRgba(SIZE, SIZE);
  drawDiamond(d, SIZE, 40, 40, 28, ...color);
  drawDiamond(d, SIZE, 40, 40, 14, 0, 0, 0, 0); // inner cutout
  // Center dot
  drawCircle(d, SIZE, 40, 40, 6, ...color);
  return d;
}

// 2. 资料 (catalog) - book/document shape
function makeCatalog(color) {
  const d = makeRgba(SIZE, SIZE);
  // Book body
  drawRect(d, SIZE, 18, 14, 62, 66, ...color);
  // Spine
  drawRect(d, SIZE, 18, 14, 26, 66, ...color);
  // Page lines
  for (let y = 24; y <= 56; y += 8) {
    drawRect(d, SIZE, 32, y, 56, y + 2, ...color);
  }
  return d;
}

// 3. 抽卡 (draw) - card/ticket shape
function makeDraw(color) {
  const d = makeRgba(SIZE, SIZE);
  // Card body
  drawRect(d, SIZE, 16, 18, 64, 62, ...color);
  // Inner highlight
  drawRect(d, SIZE, 22, 24, 58, 56, 0, 0, 0, 0);
  // Star in center
  drawDiamond(d, SIZE, 40, 38, 12, ...color);
  return d;
}

// 4. 对位 (matchup) - cross swords
function makeMatchup(color) {
  const d = makeRgba(SIZE, SIZE);
  // Two diagonal lines crossing
  drawLine(d, SIZE, 18, 18, 62, 62, ...color, 4);
  drawLine(d, SIZE, 62, 18, 18, 62, ...color, 4);
  // Center circle
  drawCircle(d, SIZE, 40, 40, 8, ...color);
  return d;
}

// 5. 我的 (account) - person silhouette
function makeAccount(color) {
  const d = makeRgba(SIZE, SIZE);
  // Head
  drawCircle(d, SIZE, 40, 24, 12, ...color);
  // Body
  drawCircle(d, SIZE, 40, 56, 22, ...color);
  return d;
}

const icons = [
  ["analyze", makeAnalyze],
  ["catalog", makeCatalog],
  ["draw", makeDraw],
  ["matchup", makeMatchup],
  ["account", makeAccount],
];

for (const [name, fn] of icons) {
  saveIcon(`${name}`, fn(DIM));
  saveIcon(`${name}-active`, fn(GOLD));
}

console.log(`\nGenerated ${icons.length * 2} icons in ${ICON_DIR}`);
