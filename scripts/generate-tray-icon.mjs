#!/usr/bin/env node

/**
 * Generate a menu bar tray icon — white silhouette with black outline.
 * 22x22 is the standard macOS menu bar icon size.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';

const SIZE = 22;
// macOS template icon: black on transparent. macOS auto-inverts for dark mode.
const BLACK = [0x00, 0x00, 0x00, 0xFF];
const WHITE = [0xFF, 0xFF, 0xFF, 0xFF];
const CLEAR = [0x00, 0x00, 0x00, 0x00];

function createBuffer() {
  return new Uint8Array(SIZE * SIZE * 4);
}

function px(buf, x, y, color) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = color[0]; buf[i+1] = color[1]; buf[i+2] = color[2]; buf[i+3] = color[3];
}

function rect(buf, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      px(buf, x + dx, y + dy, color);
}

// Draw outline around filled pixels
function addOutline(buf) {
  const copy = new Uint8Array(buf);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (copy[i + 3] === 0) {
        // Check if any neighbor is filled
        const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of neighbors) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
            const ni = (ny * SIZE + nx) * 4;
            if (copy[ni + 3] > 0 && copy[ni] === WHITE[0]) {
              px(buf, x, y, BLACK);
              break;
            }
          }
        }
      }
    }
  }
}

function drawTrayPet() {
  const buf = createBuffer();
  // Centered pet in 22x22 — simplified silhouette
  // macOS template: black fill on transparent. macOS inverts for dark mode.
  // Head (y: 2-8)
  rect(buf, 9, 2, 4, 6, BLACK);
  rect(buf, 8, 3, 6, 4, BLACK);
  // Body (y: 8-14)
  rect(buf, 9, 8, 4, 6, BLACK);
  rect(buf, 8, 9, 6, 4, BLACK);
  // Arms
  rect(buf, 6, 10, 2, 3, BLACK);
  rect(buf, 14, 10, 2, 3, BLACK);
  // Legs
  rect(buf, 9, 14, 2, 2, BLACK);
  rect(buf, 11, 14, 2, 2, BLACK);
  // Eyes (cutout — transparent holes)
  px(buf, 9, 4, CLEAR);
  px(buf, 12, 4, CLEAR);
  return buf;
}

// Minimal PNG encoder
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU32BE(buf, off, val) {
  buf[off] = (val >>> 24) & 0xFF; buf[off+1] = (val >>> 16) & 0xFF;
  buf[off+2] = (val >>> 8) & 0xFF; buf[off+3] = val & 0xFF;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(4 + tb.length + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  tb.copy(chunk, 4);
  (data.copy ? data : Buffer.from(data)).copy(chunk, 8);
  const crcBuf = Buffer.alloc(tb.length + data.length);
  tb.copy(crcBuf, 0);
  (data.copy ? data : Buffer.from(data)).copy(crcBuf, 4);
  writeU32BE(chunk, 8 + data.length, crc32(crcBuf));
  return chunk;
}

function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, 0, w); writeU32BE(ihdr, 4, h);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  let off = 0;
  for (let y = 0; y < h; y++) { raw[off++] = 0; for (let x = 0; x < w * 4; x++) raw[off++] = rgba[y * w * 4 + x]; }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, {level:9})), pngChunk('IEND', Buffer.alloc(0))]);
}

const buf = drawTrayPet();
const png = encodePNG(buf, SIZE, SIZE);
const outPath = join(import.meta.dirname, '..', 'src-tauri', 'icons', 'tray-icon.png');
writeFileSync(outPath, png);
console.log(`Tray icon generated: ${outPath} (${png.length} bytes)`);
