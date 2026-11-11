const { ditherWithMap } = require("./threshold-map");
const { size, thresholds } = require("./blue-noise-data");

const table = Float32Array.from(thresholds, (value) => (value + 0.5) / 256);

function run(input) {
  return ditherWithMap(input, table, size, size);
}

module.exports = { id: "blueNoise", params: [], process: run, TILE_SIZE: size };
