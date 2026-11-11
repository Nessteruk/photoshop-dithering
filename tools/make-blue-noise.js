const fs = require("fs");
const path = require("path");

const SIZE = 128;
const COUNT = SIZE * SIZE;
const SIGMA = 1.5;
const INITIAL_RATIO = 0.1;
const outputFile = process.argv[2] || path.join(__dirname, "..", "src", "algorithms", "blue-noise-data.js");

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kernel = new Float64Array(COUNT);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = Math.min(x, SIZE - x);
    const dy = Math.min(y, SIZE - y);
    kernel[y * SIZE + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
  }
}

function addEnergy(energy, index, sign) {
  const px = index % SIZE;
  const py = (index - px) / SIZE;
  for (let y = 0; y < SIZE; y++) {
    const row = ((y - py + SIZE) % SIZE) * SIZE;
    const base = y * SIZE;
    for (let x = 0; x < SIZE; x++) {
      energy[base + x] += sign * kernel[row + ((x - px + SIZE) % SIZE)];
    }
  }
}

function tightestCluster(pattern, energy) {
  let best = -1;
  let bestValue = -Infinity;
  for (let i = 0; i < COUNT; i++) {
    if (pattern[i] === 1 && energy[i] > bestValue) {
      bestValue = energy[i];
      best = i;
    }
  }
  return best;
}

function largestVoid(pattern, energy) {
  let best = -1;
  let bestValue = Infinity;
  for (let i = 0; i < COUNT; i++) {
    if (pattern[i] === 0 && energy[i] < bestValue) {
      bestValue = energy[i];
      best = i;
    }
  }
  return best;
}

function energyOf(pattern) {
  const energy = new Float64Array(COUNT);
  for (let i = 0; i < COUNT; i++) if (pattern[i] === 1) addEnergy(energy, i, 1);
  return energy;
}

function initialPattern() {
  const next = random(20260101);
  const order = Array.from({ length: COUNT }, (_, i) => i);
  for (let i = COUNT - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pattern = new Uint8Array(COUNT);
  for (let i = 0; i < Math.round(COUNT * INITIAL_RATIO); i++) pattern[order[i]] = 1;
  return pattern;
}

function relax(pattern) {
  const energy = energyOf(pattern);
  for (;;) {
    const cluster = tightestCluster(pattern, energy);
    pattern[cluster] = 0;
    addEnergy(energy, cluster, -1);
    const gap = largestVoid(pattern, energy);
    pattern[gap] = 1;
    addEnergy(energy, gap, 1);
    if (gap === cluster) return;
  }
}

function rank(pattern) {
  const ranks = new Uint32Array(COUNT);
  const ones = pattern.reduce((sum, value) => sum + value, 0);

  const removal = Uint8Array.from(pattern);
  const removalEnergy = energyOf(removal);
  for (let r = ones - 1; r >= 0; r--) {
    const cluster = tightestCluster(removal, removalEnergy);
    removal[cluster] = 0;
    addEnergy(removalEnergy, cluster, -1);
    ranks[cluster] = r;
  }

  const filling = Uint8Array.from(pattern);
  const fillingEnergy = energyOf(filling);
  for (let r = ones; r < COUNT; r++) {
    const gap = largestVoid(filling, fillingEnergy);
    filling[gap] = 1;
    addEnergy(fillingEnergy, gap, 1);
    ranks[gap] = r;
  }
  return ranks;
}

const pattern = initialPattern();
relax(pattern);
const ranks = rank(pattern);
const thresholds = Array.from(ranks, (value) => Math.floor((value * 256) / COUNT));

const lines = [];
for (let i = 0; i < thresholds.length; i += SIZE) lines.push("  " + thresholds.slice(i, i + SIZE).join(","));
fs.writeFileSync(
  outputFile,
  "module.exports = {\n  size: " + SIZE + ",\n  thresholds: new Uint8Array([\n" + lines.join(",\n") + "\n  ])\n};\n"
);
console.log("written", outputFile);
