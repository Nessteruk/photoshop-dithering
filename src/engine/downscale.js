function downscale(image, scale) {
  const factor = Math.max(1, Math.floor(scale));
  if (factor === 1) return image;
  const { width, height, components, data } = image;
  const outWidth = Math.ceil(width / factor);
  const outHeight = Math.ceil(height / factor);
  const out = new Uint8Array(outWidth * outHeight * components);
  const hasAlpha = components === 4 || components === 2;
  const colorCount = hasAlpha ? components - 1 : components;
  const sums = new Float64Array(components);

  for (let oy = 0; oy < outHeight; oy++) {
    const y0 = oy * factor;
    const y1 = Math.min(height, y0 + factor);
    for (let ox = 0; ox < outWidth; ox++) {
      const x0 = ox * factor;
      const x1 = Math.min(width, x0 + factor);
      sums.fill(0);
      let alphaSum = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const offset = (y * width + x) * components;
          const weight = hasAlpha ? data[offset + colorCount] : 255;
          alphaSum += weight;
          for (let c = 0; c < colorCount; c++) sums[c] += data[offset + c] * weight;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const target = (oy * outWidth + ox) * components;
      for (let c = 0; c < colorCount; c++) out[target + c] = alphaSum > 0 ? Math.round(sums[c] / alphaSum) : 0;
      if (hasAlpha) out[target + colorCount] = Math.round(alphaSum / count);
    }
  }
  return { width: outWidth, height: outHeight, components, data: out };
}

module.exports = { downscale };
