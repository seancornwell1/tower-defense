// Generates grey-box PNG app icons (a wagon carrying a stack of blocks).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x / size, y / size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const colors = [[232, 212, 77], [127, 214, 240], [200, 75, 75]];
function draw(u, v) {
  const bg = [43, 47, 56];
  if (v > 0.84) return [93, 83, 72];
  // wheels
  for (const cx of [0.36, 0.64]) if ((u - cx) ** 2 + (v - 0.8) ** 2 < 0.004) return [30, 30, 30];
  if (u > 0.26 && u < 0.74 && v > 0.7 && v < 0.78) return [107, 90, 72];
  for (let i = 0; i < 3; i++) {
    const top = 0.52 - i * 0.17, bot = top + 0.16;
    if (u > 0.3 && u < 0.7 && v > top && v < bot) {
      if (u > 0.33 && u < 0.39) return colors[i];
      return [138, 143, 153];
    }
  }
  if (u > 0.44 && u < 0.56 && v > 0.08 && v < 0.18) return [240, 200, 160];
  return bg;
}
for (const s of [180, 192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), png(s, draw));
console.log('icons written');
