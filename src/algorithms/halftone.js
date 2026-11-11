const TAU = Math.PI * 2;
const SQRT3_2 = Math.sqrt(3) / 2;
const EPSILON = 1e-9;
const MIN_SIZE = 2;
const TABLE_SIDE = 96;
const TONE_STEPS = 255;

const SHAPES = ["square", "hexagon", "radial", "line", "circle"];

const SPOTS = {
  square: (u, v) => Math.max(Math.abs(u), Math.abs(v)),
  circle: (u, v) => Math.sqrt(u * u + v * v),
  hexagon: (u, v) => Math.max(Math.abs(u), Math.abs(0.5 * u + SQRT3_2 * v), Math.abs(0.5 * u - SQRT3_2 * v))
};

const SPOT_OF_SHAPE = { square: "square", circle: "circle", hexagon: "hexagon", radial: "circle" };
const tableCache = {};

function inDomain(spotName, u, v) {
  if (spotName === "hexagon") return SPOTS.hexagon(u, v) <= 0.5 + EPSILON;
  return Math.abs(u) <= 0.5 + EPSILON && Math.abs(v) <= 0.5 + EPSILON;
}

function thresholdTable(spotName) {
  if (tableCache[spotName]) return tableCache[spotName];
  const spot = SPOTS[spotName];
  const extent = spotName === "hexagon" ? 0.6 : 0.5;
  const samples = [];
  for (let j = 0; j < TABLE_SIDE; j++) {
    for (let i = 0; i < TABLE_SIDE; i++) {
      const u = ((i + 0.5) / TABLE_SIDE - 0.5) * 2 * extent;
      const v = ((j + 0.5) / TABLE_SIDE - 0.5) * 2 * extent;
      if (inDomain(spotName, u, v)) samples.push(spot(u, v));
    }
  }
  const sorted = Float32Array.from(samples).sort();
  const table = new Float32Array(TONE_STEPS + 1);
  for (let tone = 0; tone <= TONE_STEPS; tone++) {
    if (tone === 0) table[tone] = -1;
    else if (tone === TONE_STEPS) table[tone] = Infinity;
    else table[tone] = sorted[Math.max(0, Math.round((tone / TONE_STEPS) * sorted.length) - 1)];
  }
  tableCache[spotName] = table;
  return table;
}

function createToneSampler(input, outputWidth, outputHeight) {
  const { values, width, height } = input;
  const scaleX = width / outputWidth;
  const scaleY = height / outputHeight;
  return (x, y) => {
    const fx = Math.min(width - 1, Math.max(0, x * scaleX - 0.5));
    const fy = Math.min(height - 1, Math.max(0, y * scaleY - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = values[y0 * width + x0] * (1 - tx) + values[y0 * width + x1] * tx;
    const bottom = values[y1 * width + x0] * (1 - tx) + values[y1 * width + x1] * tx;
    return (255 - (top * (1 - ty) + bottom * ty)) / 255;
  };
}

function latticeRange(outputWidth, outputHeight, cos, sin) {
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;
  const range = { uMin: Infinity, uMax: -Infinity, vMin: Infinity, vMax: -Infinity };
  [[0, 0], [outputWidth, 0], [0, outputHeight], [outputWidth, outputHeight]].forEach(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    range.uMin = Math.min(range.uMin, u);
    range.uMax = Math.max(range.uMax, u);
    range.vMin = Math.min(range.vMin, v);
    range.vMax = Math.max(range.vMax, v);
  });
  return range;
}

function squareSampler(context) {
  const { outputWidth, outputHeight, size, pitch, angle, tone, spotName } = context;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;
  const spot = SPOTS[spotName];
  const table = thresholdTable(spotName);
  const range = latticeRange(outputWidth, outputHeight, cos, sin);
  const iMin = Math.floor(range.uMin / pitch) - 1;
  const jMin = Math.floor(range.vMin / pitch) - 1;
  const columns = Math.ceil(range.uMax / pitch) + 2 - iMin;
  const rows = Math.ceil(range.vMax / pitch) + 2 - jMin;
  const thresholds = new Float32Array(columns * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const u = (i + iMin) * pitch;
      const v = (j + jMin) * pitch;
      const darkness = tone(centerX + u * cos - v * sin, centerY + u * sin + v * cos);
      thresholds[j * columns + i] = table[Math.round(darkness * TONE_STEPS)];
    }
  }
  return (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const i = Math.round(u / pitch);
    const j = Math.round(v / pitch);
    const localU = (u - i * pitch) / size;
    const localV = (v - j * pitch) / size;
    if (Math.abs(localU) > 0.5 + EPSILON || Math.abs(localV) > 0.5 + EPSILON) return false;
    return spot(localU, localV) <= thresholds[(j - jMin) * columns + (i - iMin)];
  };
}

function hexagonSampler(context) {
  const { outputWidth, outputHeight, size, pitch, angle, tone } = context;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;
  const rowStep = pitch * SQRT3_2;
  const spot = SPOTS.hexagon;
  const table = thresholdTable("hexagon");
  const range = latticeRange(outputWidth, outputHeight, cos, sin);
  const iMin = Math.floor(range.uMin / pitch) - 2;
  const jMin = Math.floor(range.vMin / rowStep) - 2;
  const columns = Math.ceil(range.uMax / pitch) + 3 - iMin;
  const rows = Math.ceil(range.vMax / rowStep) + 3 - jMin;
  const thresholds = new Float32Array(columns * rows);
  for (let j = 0; j < rows; j++) {
    const v = (j + jMin) * rowStep;
    const shift = ((j + jMin) & 1) * 0.5;
    for (let i = 0; i < columns; i++) {
      const u = (i + iMin + shift) * pitch;
      const darkness = tone(centerX + u * cos - v * sin, centerY + u * sin + v * cos);
      thresholds[j * columns + i] = table[Math.round(darkness * TONE_STEPS)];
    }
  }
  return (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const middle = Math.round(v / rowStep);
    let best = Infinity;
    let bestIndex = 0;
    for (let j = middle - 1; j <= middle + 1; j++) {
      const shift = (j & 1) * 0.5;
      const i = Math.round(u / pitch - shift);
      const value = spot((u - (i + shift) * pitch) / size, (v - j * rowStep) / size);
      if (value < best) {
        best = value;
        bestIndex = (j - jMin) * columns + (i - iMin);
      }
    }
    return best <= 0.5 + EPSILON && best <= thresholds[bestIndex];
  };
}

function lineSampler(context) {
  const { outputWidth, outputHeight, size, pitch, angle, tone } = context;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;
  return (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const j = Math.round(v / pitch);
    const offset = Math.abs(v - j * pitch);
    if (offset > size / 2 + EPSILON) return false;
    const line = j * pitch;
    const darkness = tone(centerX + u * cos - line * sin, centerY + u * sin + line * cos);
    return darkness > 0 && offset <= (darkness * size) / 2 + EPSILON;
  };
}

function radialSampler(context) {
  const { outputWidth, outputHeight, size, pitch, phase, tone } = context;
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;
  const table = thresholdTable("circle");
  const maxRadius = Math.hypot(Math.max(centerX, outputWidth - centerX), Math.max(centerY, outputHeight - centerY));
  const rings = Math.ceil(maxRadius / pitch) + 1;
  const counts = new Int32Array(rings);
  const thresholds = [];
  for (let k = 0; k < rings; k++) {
    const count = k === 0 ? 1 : Math.max(1, Math.round(TAU * k));
    const ring = new Float32Array(count);
    for (let j = 0; j < count; j++) {
      const angle = (TAU * j) / count + phase;
      const darkness = tone(centerX + k * pitch * Math.cos(angle), centerY + k * pitch * Math.sin(angle));
      ring[j] = table[Math.round(darkness * TONE_STEPS)];
    }
    counts[k] = count;
    thresholds.push(ring);
  }
  return (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const k = Math.round(radius / pitch);
    if (k >= rings) return false;
    let localU = dx;
    let localV = dy;
    let width = size;
    let threshold = thresholds[0][0];
    if (k > 0) {
      const count = counts[k];
      const step = TAU / count;
      const angle = Math.atan2(dy, dx) - phase;
      const j = Math.round(angle / step);
      const ringRadius = k * pitch;
      localU = radius - ringRadius;
      localV = (angle - j * step) * ringRadius;
      width = (size * step * ringRadius) / pitch;
      threshold = thresholds[k][((j % count) + count) % count];
    }
    const u = localU / size;
    const v = localV / width;
    if (Math.abs(u) > 0.5 + EPSILON || Math.abs(v) > 0.5 + EPSILON) return false;
    return Math.sqrt(u * u + v * v) <= threshold;
  };
}

const SAMPLERS = {
  square: squareSampler,
  circle: squareSampler,
  hexagon: hexagonSampler,
  line: lineSampler,
  radial: radialSampler
};

function rasterize(inside, width, height, levelCount) {
  const top = levelCount - 1;
  const levels = new Uint8Array(width * height);
  if (top === 1) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) levels[y * width + x] = inside(x + 0.5, y + 0.5) ? 0 : 1;
    }
    return levels;
  }
  const side = Math.max(1, Math.ceil(Math.sqrt(top)));
  const total = side * side;
  const quickCheck = side >= 3;
  let upper = new Uint8Array(width + 1);
  let lower = new Uint8Array(width + 1);
  if (quickCheck) {
    for (let x = 0; x <= width; x++) upper[x] = inside(x, 0) ? 1 : 0;
  }
  for (let y = 0; y < height; y++) {
    if (quickCheck) {
      for (let x = 0; x <= width; x++) lower[x] = inside(x, y + 1) ? 1 : 0;
    }
    for (let x = 0; x < width; x++) {
      let ink = -1;
      if (quickCheck) {
        const hits = upper[x] + upper[x + 1] + lower[x] + lower[x + 1] + (inside(x + 0.5, y + 0.5) ? 1 : 0);
        if (hits === 0) ink = 0;
        else if (hits === 5) ink = 1;
      }
      if (ink < 0) {
        let covered = 0;
        for (let sy = 0; sy < side; sy++) {
          for (let sx = 0; sx < side; sx++) {
            if (inside(x + (sx + 0.5) / side, y + (sy + 0.5) / side)) covered++;
          }
        }
        ink = covered / total;
      }
      levels[y * width + x] = top - Math.round(ink * top);
    }
    const swap = upper;
    upper = lower;
    lower = swap;
  }
  return levels;
}

function pitchOf(settings) {
  return Math.max(MIN_SIZE, settings.cellSize) + settings.spacing;
}

function run(input, settings) {
  const outputWidth = input.outputWidth || input.width;
  const outputHeight = input.outputHeight || input.height;
  const shape = SAMPLERS[settings.shape] ? settings.shape : "circle";
  const size = Math.max(MIN_SIZE, settings.cellSize);
  const separate = input.channelCount === 3;
  const offset = separate ? (input.channel || 0) * settings.channelAngle : 0;
  const degrees = (shape === "radial" ? 0 : settings.angle) + offset;
  const inside = SAMPLERS[shape]({
    outputWidth,
    outputHeight,
    size,
    pitch: pitchOf(settings),
    angle: (degrees * Math.PI) / 180,
    phase: (offset * Math.PI) / 180,
    tone: createToneSampler(input, outputWidth, outputHeight),
    spotName: SPOT_OF_SHAPE[shape]
  });
  return { width: outputWidth, height: outputHeight, levels: rasterize(inside, outputWidth, outputHeight, input.levelCount) };
}

module.exports = {
  id: "halftone",
  atOutputResolution: true,
  readScale: (settings) => Math.max(1, Math.floor(pitchOf(settings) / 2)),
  params: [
    {
      key: "shape",
      type: "select",
      section: "pattern",
      default: "circle",
      options: SHAPES.map((value) => ({ value }))
    },
    {
      key: "spacing",
      type: "slider",
      section: "pattern",
      min: 0,
      max: 32,
      step: 1,
      unit: " px",
      default: 0,
      order: 11
    },
    {
      key: "angle",
      type: "slider",
      section: "pattern",
      min: 0,
      max: 180,
      step: 1,
      unit: "°",
      default: 45,
      order: 12,
      hideWhen: { key: "shape", values: ["radial"] }
    },
    {
      key: "channelAngle",
      type: "slider",
      section: "colors",
      min: 0,
      max: 60,
      step: 1,
      unit: "°",
      default: 0,
      order: 13,
      hideWhen: { key: "colorMode", values: ["gray"] }
    }
  ],
  process: run
};
