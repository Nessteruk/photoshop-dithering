function toPlanes(image, colorMode) {
  const { width, height, components, data } = image;
  const count = width * height;
  const alpha = new Uint8ClampedArray(count);
  const separate = colorMode === "color" && components >= 3;
  const planes = separate
    ? [new Uint8ClampedArray(count), new Uint8ClampedArray(count), new Uint8ClampedArray(count)]
    : [new Uint8ClampedArray(count)];

  for (let i = 0; i < count; i++) {
    const offset = i * components;
    if (components >= 3) {
      if (separate) {
        planes[0][i] = data[offset];
        planes[1][i] = data[offset + 1];
        planes[2][i] = data[offset + 2];
      } else {
        planes[0][i] = Math.round(0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]);
      }
      alpha[i] = components === 4 ? data[offset + 3] : 255;
    } else {
      planes[0][i] = data[offset];
      alpha[i] = components === 2 ? data[offset + 1] : 255;
    }
  }
  return { planes, alpha };
}

module.exports = { toPlanes };
