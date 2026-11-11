const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outputDir = process.argv[2] || path.join(__dirname, "..", "icons");

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

const VARIANTS = { onDark: [224, 224, 224], onLight: [58, 58, 58] };

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuffer, data])) >>> 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, alphaAt, rgb) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * (size * 4 + 1) + 1 + x * 4;
      raw[index] = rgb[0];
      raw[index + 1] = rgb[1];
      raw[index + 2] = rgb[2];
      raw[index + 3] = alphaAt(x, y);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function pluginAlpha(size) {
  const block = size / 23;
  return (x, y) => {
    const level = (x / block / 22 + y / block / 22) / 2;
    const threshold = (BAYER[Math.floor(y / block) % 4][Math.floor(x / block) % 4] + 0.5) / 16;
    const margin = 2 * block;
    const inside = x >= margin && x < size - margin && y >= margin && y < size - margin;
    return level > threshold && inside ? 255 : 0;
  };
}

function write(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
}

Object.keys(VARIANTS).forEach((variant) => {
  const rgb = VARIANTS[variant];
  write(path.join(outputDir, "plugin-" + variant + ".png"), encodePng(23, pluginAlpha(23), rgb));
  write(path.join(outputDir, "plugin-" + variant + "@2x.png"), encodePng(46, pluginAlpha(46), rgb));
});
