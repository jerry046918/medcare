// 零依赖生成 PWA 图标:渐变底 + 心形,Heart 隐式曲线 (x²+y²-1)³ - x²y³ ≤ 0
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(file, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x / (size - 1), y / (size - 1));
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(__dirname, '..', 'public', file), png);
  console.log(`生成 ${file} (${size}x${size})`);
}
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function pixel(nx, ny) {
  const x = nx * 2.8 - 1.4;
  const y = 1.4 - ny * 2.8;
  const inHeart = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
  if (inHeart) return [255, 255, 255, 255];
  return [lerp(6, 59, ny), lerp(182, 130, ny), lerp(212, 246, ny), 255]; // #06b6d4 → #3b82f6
}
writePng('pwa-192.png', 192, pixel);
writePng('pwa-512.png', 512, pixel);
writePng('apple-touch-icon.png', 180, pixel);
