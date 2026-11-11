const NEUTRAL = 50;

function buildLut(settings) {
  const lut = new Uint8ClampedArray(256);
  const factor = Math.pow(2, (settings.contrast - NEUTRAL) / 10);
  const shift = (settings.brightness - NEUTRAL) / 100;
  for (let i = 0; i < 256; i++) {
    const value = (i / 255 - 0.5) * factor + 0.5 + shift;
    lut[i] = Math.round(Math.min(1, Math.max(0, value)) * 255);
  }
  return lut;
}

function applyAdjustments(gray, lut) {
  for (let i = 0; i < gray.length; i++) gray[i] = lut[gray[i]];
  return gray;
}

module.exports = { buildLut, applyAdjustments };
