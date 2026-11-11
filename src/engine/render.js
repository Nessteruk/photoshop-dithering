const { getAlgorithm } = require("../algorithms/index");
const { toPlanes } = require("./planes");
const { buildLut, applyAdjustments } = require("./adjust");
const { compose } = require("./compose");

function render(image, outputSize, settings) {
  const { width, height } = image;
  const { planes, alpha } = toPlanes(image, settings.colorMode);
  const algorithm = getAlgorithm(settings.algorithm);
  const levelCount = settings.levels;
  const lut = buildLut(settings);
  const results = planes.map((values, channel) => {
    applyAdjustments(values, lut);
    const input = {
      width,
      height,
      values,
      levelCount,
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      channel,
      channelCount: planes.length
    };
    return algorithm.process(input, settings).levels;
  });
  const fullResolution = algorithm.atOutputResolution === true;
  const rgba = compose(
    {
      planes: results,
      planeWidth: fullResolution ? outputSize.width : width,
      planeHeight: fullResolution ? outputSize.height : height,
      alpha,
      width,
      height,
      levelCount
    },
    outputSize.width,
    outputSize.height
  );
  return { width: outputSize.width, height: outputSize.height, rgba };
}

module.exports = { render };
