const KERNELS = {
  floydSteinberg: { divisor: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { divisor: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  stucki: {
    divisor: 42,
    taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]]
  },
  sierraLite: { divisor: 4, taps: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] }
};

function diffuse(input, kernel) {
  const { width, height, values, levelCount } = input;
  const top = levelCount - 1;
  const count = width * height;
  const work = new Float32Array(count);
  for (let i = 0; i < count; i++) work[i] = (255 - values[i]) / 255;
  const levels = new Uint8Array(count);
  const tapCount = kernel.taps.length;
  const offsetX = new Int32Array(tapCount);
  const offsetY = new Int32Array(tapCount);
  const weight = new Float32Array(tapCount);
  kernel.taps.forEach((tap, i) => {
    offsetX[i] = tap[0];
    offsetY[i] = tap[1];
    weight[i] = tap[2] / kernel.divisor;
  });

  for (let y = 0; y < height; y++) {
    const reverse = y % 2 === 1;
    for (let i = 0; i < width; i++) {
      const x = reverse ? width - 1 - i : i;
      const index = y * width + x;
      const value = work[index];
      const ink = Math.min(top, Math.max(0, Math.round(value * top)));
      levels[index] = top - ink;
      const error = value - ink / top;
      if (error === 0) continue;
      for (let k = 0; k < tapCount; k++) {
        const nx = x + (reverse ? -offsetX[k] : offsetX[k]);
        const ny = y + offsetY[k];
        if (nx < 0 || nx >= width || ny >= height) continue;
        work[ny * width + nx] += error * weight[k];
      }
    }
  }
  return { width, height, levels };
}

const algorithms = Object.keys(KERNELS).map((id) => ({
  id,
  params: [],
  process: (input) => diffuse(input, KERNELS[id])
}));

module.exports = { algorithms, KERNELS };
