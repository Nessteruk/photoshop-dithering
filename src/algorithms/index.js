const { algorithms: diffusion } = require("./diffusion");
const bayer = require("./bayer");
const blueNoise = require("./blue-noise");
const halftone = require("./halftone");

const ALGORITHMS = [].concat(diffusion, bayer, blueNoise, halftone);

function getAlgorithm(id) {
  return ALGORITHMS.find((algorithm) => algorithm.id === id) || ALGORITHMS[0];
}

function getReadScale(settings) {
  const algorithm = getAlgorithm(settings.algorithm);
  return algorithm.readScale ? algorithm.readScale(settings) : settings.cellSize;
}

module.exports = { ALGORITHMS, getAlgorithm, getReadScale };
