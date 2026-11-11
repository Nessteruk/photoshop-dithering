const { ditherWithMap } = require("./threshold-map");

const MATRIX_SIZES = ["2", "4", "8", "16"];
const thresholdCache = {};

function bayerMatrix(size) {
  let matrix = [[0]];
  for (let current = 1; current < size; current *= 2) {
    const next = [];
    for (let y = 0; y < current * 2; y++) next.push(new Array(current * 2));
    for (let y = 0; y < current; y++) {
      for (let x = 0; x < current; x++) {
        const base = 4 * matrix[y][x];
        next[y][x] = base;
        next[y][x + current] = base + 2;
        next[y + current][x] = base + 3;
        next[y + current][x + current] = base + 1;
      }
    }
    matrix = next;
  }
  return matrix;
}

function thresholds(size) {
  if (thresholdCache[size]) return thresholdCache[size];
  const matrix = bayerMatrix(size);
  const count = size * size;
  const values = new Float32Array(count);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) values[y * size + x] = (matrix[y][x] + 0.5) / count;
  }
  thresholdCache[size] = values;
  return values;
}

function run(input, settings) {
  const size = Number(settings.matrix) || 4;
  return ditherWithMap(input, thresholds(size), size, size);
}

module.exports = {
  id: "bayer",
  params: [
    {
      key: "matrix",
      type: "choice",
      section: "pattern",
      default: "4",
      options: MATRIX_SIZES.map((value) => ({ value }))
    }
  ],
  process: run,
  bayerMatrix
};
