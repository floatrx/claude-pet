#!/usr/bin/env node

/**
 * Generate all Tauri app icons from the pet character sprite.
 * Pure Node.js — uses built-in zlib for PNG compression.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';

// ─── Colors ──────────────────────────────────────────────────────────────────
const BODY_COLOR  = [0xD9, 0x77, 0x57, 0xFF];
const BODY_LIGHT  = [0xE8, 0x95, 0x6A, 0xFF];
const EYE_COLOR   = [0x2D, 0x2D, 0x2D, 0xFF];
const WHITE       = [0xFF, 0xFF, 0xFF, 0xFF];
const TRANSPARENT = [0x00, 0x00, 0x00, 0x00];

// ─── 32x32 pixel buffer drawing ──────────────────────────────────────────────
const SPRITE_SIZE = 32;

function createBuffer() {
  return new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4); // RGBA
}

function px(buf, x, y, color) {
  if (x < 0 || x >= SPRITE_SIZE || y < 0 || y >= SPRITE_SIZE) return;
  const i = (y * SPRITE_SIZE + x) * 4;
  buf[i]     = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function rect(buf, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      px(buf, x + dx, y + dy, color);
    }
  }
}

function drawBody(buf, yOffset = 0) {
  const y = 8 + yOffset;
  // Head
  rect(buf, 12, y, 8, 8, BODY_COLOR);
  rect(buf, 11, y + 1, 10, 6, BODY_COLOR);
  rect(buf, 10, y + 2, 12, 4, BODY_COLOR);
  // Highlight on head
  rect(buf, 12, y + 1, 4, 2, BODY_LIGHT);
  // Body
  rect(buf, 11, y + 8, 10, 8, BODY_COLOR);
  rect(buf, 10, y + 9, 12, 6, BODY_COLOR);
  // Highlight on body
  rect(buf, 11, y + 9, 3, 3, BODY_LIGHT);
}

function drawEyes(buf, yOffset = 0) {
  const y = 8 + yOffset;
  // Open eyes
  rect(buf, 13, y + 3, 2, 2, EYE_COLOR);
  rect(buf, 17, y + 3, 2, 2, EYE_COLOR);
  // Eye highlights
  px(buf, 13, y + 3, WHITE);
  px(buf, 17, y + 3, WHITE);
}

function drawArms(buf, yOffset = 0) {
  const y = 8 + yOffset;
  rect(buf, 8, y + 10, 2, 4, BODY_COLOR);
  rect(buf, 22, y + 10, 2, 4, BODY_COLOR);
}

function drawLegs(buf, yOffset = 0) {
  const y = 8 + yOffset;
  const legY = y + 16;
  rect(buf, 12, legY, 3, 2, BODY_COLOR);
  rect(buf, 18, legY, 3, 2, BODY_COLOR);
}

function drawPet() {
  const buf = createBuffer();
  drawBody(buf);
  drawEyes(buf);
  drawArms(buf);
  drawLegs(buf);
  return buf;
}

// ─── Nearest-neighbor scale ──────────────────────────────────────────────────
function scaleBuffer(src, srcSize, dstSize) {
  const dst = new Uint8Array(dstSize * dstSize * 4);
  const ratio = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.floor(x * ratio);
      const sy = Math.floor(y * ratio);
      const si = (sy * srcSize + sx) * 4;
      const di = (y * dstSize + x) * 4;
      dst[di]     = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return dst;
}

// ─── Minimal PNG encoder ─────────────────────────────────────────────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU32BE(buf, offset, val) {
  buf[offset]     = (val >>> 24) & 0xFF;
  buf[offset + 1] = (val >>> 16) & 0xFF;
  buf[offset + 2] = (val >>> 8)  & 0xFF;
  buf[offset + 3] = val & 0xFF;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(4 + typeBytes.length + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  typeBytes.copy(chunk, 4);
  data.copy ? data.copy(chunk, 8) : Buffer.from(data).copy(chunk, 8);
  const crcData = Buffer.alloc(typeBytes.length + data.length);
  typeBytes.copy(crcData, 0);
  data.copy ? data.copy(crcData, 4) : Buffer.from(data).copy(crcData, 4);
  writeU32BE(chunk, 8 + data.length, crc32(crcData));
  return chunk;
}

function encodePNG(rgba, width, height) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT — filter type 0 (None) for each row
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: None
    for (let x = 0; x < width * 4; x++) {
      raw[offset++] = rgba[y * width * 4 + x];
    }
  }
  const compressed = deflateSync(raw, { level: 9 });

  // Assemble
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', compressed);
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ─── Generate icons ──────────────────────────────────────────────────────────
const ICONS_DIR = join(import.meta.dirname, '..', 'src-tauri', 'icons');

const ICON_SPECS = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

// Draw the pet once at 32x32
const pet32 = drawPet();

console.log('Generating icons...\n');

for (const { name, size } of ICON_SPECS) {
  let rgba;
  if (size === 32) {
    rgba = pet32;
  } else if (size < 32) {
    // Scale down from 32
    rgba = scaleBuffer(pet32, 32, size);
  } else {
    // Scale up from 32 (nearest-neighbor for crisp pixel art)
    rgba = scaleBuffer(pet32, 32, size);
  }

  const png = encodePNG(rgba, size, size);
  const path = join(ICONS_DIR, name);
  writeFileSync(path, png);
  console.log(`  ${name} (${size}x${size}) — ${png.length} bytes`);
}

console.log('\nAll PNG icons generated!');
console.log('\nNote: icon.ico and icon.icns were NOT regenerated.');
console.log('To create them, use a tool like:');
console.log('  - macOS: iconutil (for .icns from .iconset folder)');
console.log('  - Cross-platform: png2ico, or online converters');
