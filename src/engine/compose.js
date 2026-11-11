const ALPHA_THRESHOLD = 128;

function sourceIndexes(outputSize, gridSize) {
  const indexes = new Uint32Array(outputSize);
  for (let i = 0; i < outputSize; i++) {
    indexes[i] = Math.min(gridSize - 1, Math.floor((i * gridSize) / outputSize));
  }
  return indexes;
}

function levelValues(levelCount) {
  const values = new Uint8Array(levelCount);
  for (let i = 0; i < levelCount; i++) values[i] = Math.round((i * 255) / (levelCount - 1));
  return values;
}

function compose(grid, outputWidth, outputHeight) {
  const { planes, alpha, levelCount } = grid;
  const planeWidth = grid.planeWidth || grid.width;
  const planeHeight = grid.planeHeight || grid.height;
  const alphaWidth = grid.width;
  const alphaHeight = grid.height;
  const values = levelValues(levelCount);
  const red = planes[0];
  const green = planes.length === 3 ? planes[1] : red;
  const blue = planes.length === 3 ? planes[2] : red;
  const rgba = new Uint8Array(outputWidth * outputHeight * 4);
  const columns = sourceIndexes(outputWidth, planeWidth);
  const rows = sourceIndexes(outputHeight, planeHeight);
  const alphaColumns = sourceIndexes(outputWidth, alphaWidth);
  const alphaRows = sourceIndexes(outputHeight, alphaHeight);

  for (let y = 0; y < outputHeight; y++) {
    const rowOffset = rows[y] * planeWidth;
    const alphaOffset = alphaRows[y] * alphaWidth;
    for (let x = 0; x < outputWidth; x++) {
      const index = rowOffset + columns[x];
      if (alpha[alphaOffset + alphaColumns[x]] < ALPHA_THRESHOLD) continue;
      const out = (y * outputWidth + x) * 4;
      rgba[out] = values[red[index]];
      rgba[out + 1] = values[green[index]];
      rgba[out + 2] = values[blue[index]];
      rgba[out + 3] = 255;
    }
  }
  return rgba;
}

module.exports = { compose, levelValues };
