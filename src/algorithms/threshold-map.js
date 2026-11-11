function ditherWithMap(input, table, tileWidth, tileHeight) {
  const { width, height, values, levelCount } = input;
  const top = levelCount - 1;
  const levels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = (y % tileHeight) * tileWidth;
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const darkness = ((255 - values[index]) / 255) * top;
      const base = Math.floor(darkness);
      const ink = Math.min(top, base + (darkness - base > table[row + (x % tileWidth)] ? 1 : 0));
      levels[index] = top - ink;
    }
  }
  return { width, height, levels };
}

module.exports = { ditherWithMap };
