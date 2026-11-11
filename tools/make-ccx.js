const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const output = path.join(root, "Dithering-" + manifest.version + ".ccx");

const FILES = [
  "manifest.json",
  "index.html",
  "styles.css",
  "dist/main.js",
  "dist/main.js.LICENSE.txt",
  "icons/plugin-onDark.png",
  "icons/plugin-onDark@2x.png",
  "icons/plugin-onLight.png",
  "icons/plugin-onLight@2x.png",
  "LICENSE",
  "THIRD-PARTY-NOTICES.md"
];

const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

function localHeader(entry) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, entry.name]);
}

function centralHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.name]);
}

const entries = FILES.map((file) => {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error("Missing file: " + file + " (run npm run build first)");
  const data = fs.readFileSync(full);
  return { name: Buffer.from(file, "utf8"), size: data.length, crc: zlib.crc32(data), compressed: zlib.deflateRawSync(data, { level: 9 }) };
});

const parts = [];
let offset = 0;
entries.forEach((entry) => {
  entry.offset = offset;
  const head = localHeader(entry);
  parts.push(head, entry.compressed);
  offset += head.length + entry.compressed.length;
});
const directoryStart = offset;
const directory = entries.map(centralHeader);
const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(directorySize, 12);
end.writeUInt32LE(directoryStart, 16);
fs.writeFileSync(output, Buffer.concat(parts.concat(directory, [end])));
console.log(path.basename(output) + ": " + entries.length + " files, " + fs.statSync(output).size + " bytes");
