const test = require("node:test");
const assert = require("node:assert/strict");

const settingsApi = require("../src/core/settings");
const { ALGORITHMS, getAlgorithm } = require("../src/algorithms/index");
const { bayerMatrix } = require("../src/algorithms/bayer");
const { KERNELS } = require("../src/algorithms/diffusion");
const blueNoise = require("../src/algorithms/blue-noise");
const { size: noiseSize, thresholds: noiseThresholds } = require("../src/algorithms/blue-noise-data");
const { toPlanes } = require("../src/engine/planes");
const { buildLut, applyAdjustments } = require("../src/engine/adjust");
const { compose, levelValues } = require("../src/engine/compose");
const { render } = require("../src/engine/render");

function settings(overrides) {
  return Object.assign(settingsApi.defaults(), overrides);
}

function flat(width, height, value, levelCount) {
  return { width, height, values: new Uint8ClampedArray(width * height).fill(value), levelCount: levelCount || 2 };
}

function process(id, input, overrides) {
  return getAlgorithm(id).process(input, settings(Object.assign({ algorithm: id }, overrides))).levels;
}

function meanDarkness(levels, levelCount) {
  let total = 0;
  for (let i = 0; i < levels.length; i++) total += (levelCount - 1 - levels[i]) / (levelCount - 1);
  return total / levels.length;
}

test("toPlanes in gray mode weights channels and reads alpha", () => {
  const image = { width: 2, height: 1, components: 4, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 0]) };
  const { planes, alpha } = toPlanes(image, "gray");
  assert.equal(planes.length, 1);
  assert.deepEqual(Array.from(planes[0]), [76, 29]);
  assert.deepEqual(Array.from(alpha), [255, 0]);
});

test("toPlanes in color mode keeps the three channels apart", () => {
  const image = { width: 2, height: 1, components: 3, data: new Uint8Array([10, 20, 30, 40, 50, 60]) };
  const { planes, alpha } = toPlanes(image, "color");
  assert.equal(planes.length, 3);
  assert.deepEqual(planes.map((plane) => Array.from(plane)), [[10, 40], [20, 50], [30, 60]]);
  assert.deepEqual(Array.from(alpha), [255, 255]);
});

test("toPlanes falls back to one plane for gray sources", () => {
  const image = { width: 2, height: 1, components: 1, data: new Uint8Array([7, 9]) };
  assert.equal(toPlanes(image, "color").planes.length, 1);
});

test("neutral contrast and brightness leave levels unchanged", () => {
  const lut = buildLut(settings());
  for (let i = 0; i < 256; i++) assert.equal(lut[i], i);
});

test("brightness moves levels up and down and keeps black and white reachable", () => {
  assert.ok(buildLut(settings({ brightness: 70 }))[100] > 100);
  assert.ok(buildLut(settings({ brightness: 30 }))[100] < 100);
  assert.equal(buildLut(settings({ brightness: 100 }))[255], 255);
  assert.equal(buildLut(settings({ brightness: 0 }))[0], 0);
});

test("contrast spreads levels around the middle", () => {
  const high = buildLut(settings({ contrast: 70 }));
  const low = buildLut(settings({ contrast: 30 }));
  assert.ok(high[200] > 200 && high[50] < 50);
  assert.ok(low[200] < 200 && low[50] > 50);
  assert.ok(Math.abs(high[128] - 128) <= 3);
});

test("contrast 100 is close to a hard threshold", () => {
  const lut = buildLut(settings({ contrast: 100 }));
  assert.equal(lut[100], 0);
  assert.equal(lut[160], 255);
});

test("applyAdjustments edits levels in place", () => {
  const levels = new Uint8ClampedArray([0, 128, 255]);
  applyAdjustments(levels, buildLut(settings({ brightness: 100 })));
  assert.deepEqual(Array.from(levels), [128, 255, 255]);
});

test("the algorithm list contains the expected entries in order", () => {
  assert.deepEqual(ALGORITHMS.map((algorithm) => algorithm.id), [
    "floydSteinberg",
    "atkinson",
    "stucki",
    "sierraLite",
    "bayer",
    "blueNoise",
    "halftone"
  ]);
});

test("every algorithm keeps white white and black black for any number of levels", () => {
  ALGORITHMS.forEach((algorithm) => {
    [2, 3, 8, 16].forEach((levelCount) => {
      const white = process(algorithm.id, flat(64, 64, 255, levelCount));
      const black = process(algorithm.id, flat(64, 64, 0, levelCount));
      assert.ok(white.every((value) => value === levelCount - 1), algorithm.id + " white " + levelCount);
      assert.ok(black.every((value) => value === 0), algorithm.id + " black " + levelCount);
    });
  });
});

test("every algorithm reproduces the tone of flat grays for any number of levels", () => {
  ALGORITHMS.forEach((algorithm) => {
    [2, 3, 4, 8, 16].forEach((levelCount) => {
      [32, 96, 128, 160, 224].forEach((value) => {
        const result = meanDarkness(process(algorithm.id, flat(300, 300, value, levelCount), { cellSize: 30 }), levelCount);
        const tolerance = algorithm.id === "atkinson" ? 0.15 : algorithm.id === "halftone" ? 0.08 : 0.04;
        assert.ok(Math.abs(result - (255 - value) / 255) < tolerance, algorithm.id + " " + levelCount + " levels, value " + value + ": " + result);
      });
    });
  });
});

test("with more levels a flat gray uses only the two levels around it", () => {
  ALGORITHMS.filter((algorithm) => algorithm.id !== "halftone").forEach((algorithm) => {
    const used = new Set(process(algorithm.id, flat(64, 64, 100, 5)));
    assert.ok(used.size <= 3, algorithm.id + " uses " + Array.from(used));
  });
  const exact = new Set(process("bayer", flat(32, 32, 128, 3)));
  assert.deepEqual(Array.from(exact).sort(), [1]);
});

test("every algorithm returns levels of the input size within range", () => {
  ALGORITHMS.forEach((algorithm) => {
    [2, 5].forEach((levelCount) => {
      const input = flat(37, 19, 100, levelCount);
      const result = getAlgorithm(algorithm.id).process(input, settings({ algorithm: algorithm.id }));
      assert.equal(result.width, 37);
      assert.equal(result.height, 19);
      assert.equal(result.levels.length, 37 * 19);
      result.levels.forEach((value) => assert.ok(value >= 0 && value < levelCount));
    });
  });
});

test("error diffusion kernels weigh to their divisor, Atkinson keeping 6/8", () => {
  Object.keys(KERNELS).forEach((name) => {
    const { divisor, taps } = KERNELS[name];
    const total = taps.reduce((sum, tap) => sum + tap[2], 0);
    assert.equal(total, name === "atkinson" ? 6 : divisor, name);
  });
});

test("error diffusion only sends error forward and down", () => {
  Object.values(KERNELS).forEach(({ taps }) => {
    taps.forEach(([dx, dy]) => assert.ok(dy > 0 || (dy === 0 && dx > 0)));
  });
});

test("Floyd-Steinberg on a 50% gray gives a checkerboard", () => {
  const levels = process("floydSteinberg", flat(8, 8, 128));
  let alternating = 0;
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) if (levels[y * 8 + x] !== levels[y * 8 + x + 1]) alternating++;
  assert.ok(alternating >= 30);
});

test("bayer matrices hold every rank exactly once and start with the classic 2x2", () => {
  assert.deepEqual(bayerMatrix(2), [[0, 2], [3, 1]]);
  assert.deepEqual(bayerMatrix(4), [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]);
  [2, 4, 8, 16].forEach((size) => {
    const ranks = bayerMatrix(size).flat().sort((a, b) => a - b);
    assert.deepEqual(ranks, Array.from({ length: size * size }, (_, i) => i));
  });
});

test("bayer repeats with the period of its matrix and larger matrices give finer tones", () => {
  [2, 4, 8, 16].forEach((size) => {
    const levels = process("bayer", flat(32, 32, 100), { matrix: String(size) });
    for (let y = 0; y + size < 32; y++) {
      for (let x = 0; x + size < 32; x++) assert.equal(levels[y * 32 + x], levels[(y + size) * 32 + x + size]);
    }
  });
  const distinct = (matrix) => new Set(
    Array.from({ length: 256 }, (_, value) => meanDarkness(process("bayer", flat(16, 16, value), { matrix }), 2).toFixed(4))
  ).size;
  assert.ok(distinct("16") > distinct("8") && distinct("8") > distinct("4") && distinct("4") > distinct("2"));
});

test("blue noise tile holds each threshold level equally often", () => {
  assert.equal(noiseThresholds.length, noiseSize * noiseSize);
  const counts = new Array(256).fill(0);
  noiseThresholds.forEach((value) => counts[value]++);
  counts.forEach((count) => assert.equal(count, (noiseSize * noiseSize) / 256));
  assert.equal(blueNoise.TILE_SIZE, noiseSize);
});

test("blue noise is far more even locally than white noise", () => {
  const spread = (map, window) => {
    const counts = [];
    for (let wy = 0; wy + window <= noiseSize; wy += window) {
      for (let wx = 0; wx + window <= noiseSize; wx += window) {
        let dots = 0;
        for (let y = 0; y < window; y++) for (let x = 0; x < window; x++) if (map[(wy + y) * noiseSize + wx + x] < 128) dots++;
        counts.push(dots);
      }
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    return counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  };
  let seed = 12345;
  const white = Uint8Array.from({ length: noiseSize * noiseSize }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
  [4, 8, 16].forEach((window) => assert.ok(spread(noiseThresholds, window) * 4 < spread(white, window), "window " + window));
});

const SHAPES = ["square", "hexagon", "radial", "line", "circle"];

test("halftone reproduces the tone of flat grays for every type and angle when elements touch", () => {
  SHAPES.forEach((shape) => {
    [0, 30, 45].forEach((angle) => {
      [40, 128, 215].forEach((value) => {
        const levels = process("halftone", flat(400, 400, value), { shape, angle, cellSize: 40, spacing: 0 });
        const result = meanDarkness(levels, 2);
        assert.ok(Math.abs(result - (255 - value) / 255) < 0.06, shape + " " + angle + "° value " + value + ": " + result);
      });
    });
  });
});

test("halftone spacing limits the darkest tone to the share of the cell the element can fill", () => {
  const black = flat(400, 400, 0);
  ["square", "circle", "hexagon", "radial"].forEach((shape) => {
    const result = meanDarkness(process("halftone", black, { shape, cellSize: 40, spacing: 40 }), 2);
    assert.ok(Math.abs(result - 0.25) < 0.05, shape + " covers " + result);
  });
  const lines = meanDarkness(process("halftone", black, { shape: "line", cellSize: 40, spacing: 40 }), 2);
  assert.ok(Math.abs(lines - 0.5) < 0.05, "line covers " + lines);
});

test("halftone black is solid when elements touch", () => {
  SHAPES.forEach((shape) => {
    const levels = process("halftone", flat(120, 90, 0), { shape, angle: 20, cellSize: 7, spacing: 0 });
    assert.ok(levels.every((value) => value === 0), shape);
  });
});

test("halftone elements grow with the tone", () => {
  SHAPES.forEach((shape) => {
    const darkness = [230, 170, 110, 50].map((value) => meanDarkness(process("halftone", flat(240, 240, value), { shape, cellSize: 24 }), 2));
    for (let i = 1; i < darkness.length; i++) assert.ok(darkness[i] > darkness[i - 1], shape + " " + darkness.join(","));
  });
});

test("halftone draws at the requested output size from a smaller tone plane", () => {
  const plane = { width: 20, height: 10, values: new Uint8ClampedArray(200).fill(128), levelCount: 2, outputWidth: 160, outputHeight: 80 };
  const result = getAlgorithm("halftone").process(plane, settings({ algorithm: "halftone", cellSize: 8 }));
  assert.equal(result.width, 160);
  assert.equal(result.height, 80);
  assert.equal(result.levels.length, 160 * 80);
});

test("halftone uses intermediate levels on the edges of the elements when levels are above 2", () => {
  const levels = process("halftone", flat(100, 100, 128, 8), { shape: "circle", cellSize: 10 });
  assert.ok(new Set(levels).size > 2);
});

test("halftone color channels share the same angle unless an offset is set", () => {
  const data = new Uint8Array(100 * 100 * 3).fill(128);
  const image = { width: 100, height: 100, components: 3, data };
  const planesFor = (channelAngle) => {
    const result = render(image, { width: 100, height: 100 }, settings({ algorithm: "halftone", colorMode: "color", shape: "line", cellSize: 10, channelAngle }));
    return [0, 1, 2].map((channel) => Array.from({ length: 100 * 100 }, (_, i) => result.rgba[i * 4 + channel]));
  };
  const aligned = planesFor(0);
  assert.deepEqual(aligned[0], aligned[1]);
  assert.deepEqual(aligned[1], aligned[2]);
  const shifted = planesFor(30);
  assert.notDeepEqual(shifted[0], shifted[1]);
  assert.notDeepEqual(shifted[1], shifted[2]);
});

test("the channel offset is only shown in color mode", () => {
  const param = settingsApi.PARAMS.find((candidate) => candidate.key === "channelAngle");
  assert.equal(param.section, "colors");
  assert.equal(settingsApi.isVisible(param, settings({ algorithm: "halftone", colorMode: "gray" })), false);
  assert.equal(settingsApi.isVisible(param, settings({ algorithm: "halftone", colorMode: "color" })), true);
  assert.equal(settingsApi.isVisible(param, settings({ algorithm: "bayer", colorMode: "color" })), false);
});

test("halftone reads the image reduced in proportion to the element pitch", () => {
  const { getReadScale } = require("../src/algorithms/index");
  assert.equal(getReadScale(settings({ algorithm: "halftone", cellSize: 12, spacing: 4 })), 8);
  assert.equal(getReadScale(settings({ algorithm: "halftone", cellSize: 2, spacing: 0 })), 1);
  assert.equal(getReadScale(settings({ algorithm: "bayer", cellSize: 5 })), 5);
});

test("level values are evenly spaced from black to white", () => {
  assert.deepEqual(Array.from(levelValues(2)), [0, 255]);
  assert.deepEqual(Array.from(levelValues(3)), [0, 128, 255]);
  assert.equal(levelValues(64)[63], 255);
});

test("compose upscales by nearest neighbour and maps levels to gray", () => {
  const grid = { width: 2, height: 1, planes: [new Uint8Array([0, 2])], alpha: new Uint8ClampedArray([255, 255]), levelCount: 3 };
  const rgba = compose(grid, 4, 2);
  assert.deepEqual(Array.from(rgba.slice(0, 4)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(rgba.slice(4, 8)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(rgba.slice(8, 12)), [255, 255, 255, 255]);
  assert.deepEqual(Array.from(rgba.slice(28, 32)), [255, 255, 255, 255]);
});

test("compose builds colors from three planes", () => {
  const grid = {
    width: 1,
    height: 1,
    planes: [new Uint8Array([1]), new Uint8Array([0]), new Uint8Array([2])],
    alpha: new Uint8ClampedArray([255]),
    levelCount: 3
  };
  assert.deepEqual(Array.from(compose(grid, 1, 1)), [128, 0, 255, 255]);
});

test("compose leaves transparent source pixels empty", () => {
  const grid = { width: 2, height: 1, planes: [new Uint8Array([0, 1])], alpha: new Uint8ClampedArray([255, 0]), levelCount: 2 };
  const rgba = compose(grid, 2, 1);
  assert.equal(rgba[3], 255);
  assert.equal(rgba[7], 0);
});

function gradient(width, height, components) {
  const data = new Uint8Array(width * height * components);
  for (let i = 0; i < width * height; i++) {
    const value = (i % width) * 6;
    for (let c = 0; c < components; c++) data[i * components + c] = c === 3 ? 255 : (value + c * 20) % 256;
  }
  return { width, height, components, data };
}

test("render in gray mode produces only the chosen number of gray levels at the requested size", () => {
  ALGORITHMS.forEach((algorithm) => {
    [2, 4].forEach((levels) => {
      const result = render(gradient(40, 30, 3), { width: 80, height: 60 }, settings({ algorithm: algorithm.id, levels, colorMode: "gray" }));
      assert.equal(result.width, 80);
      assert.equal(result.height, 60);
      assert.equal(result.rgba.length, 80 * 60 * 4);
      const colors = new Set();
      for (let i = 0; i < result.rgba.length; i += 4) {
        assert.equal(result.rgba[i], result.rgba[i + 1]);
        assert.equal(result.rgba[i], result.rgba[i + 2]);
        colors.add(result.rgba[i]);
      }
      assert.ok(colors.size <= levels, algorithm.id + " " + levels + " levels gave " + colors.size);
    });
  });
});

test("render in color mode keeps the colors of the image", () => {
  const width = 40;
  const height = 30;
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set([220, 40, 40], i * 3);
  ALGORITHMS.forEach((algorithm) => {
    const result = render({ width, height, components: 3, data }, { width, height }, settings({ algorithm: algorithm.id, levels: 4, colorMode: "color" }));
    let red = 0;
    let green = 0;
    for (let i = 0; i < result.rgba.length; i += 4) {
      red += result.rgba[i];
      green += result.rgba[i + 1];
    }
    assert.ok(red > green * 2, algorithm.id + " lost the color");
    const palette = new Set();
    for (let i = 0; i < result.rgba.length; i += 4) palette.add(result.rgba.slice(i, i + 3).join(","));
    assert.ok(palette.size <= 64, algorithm.id + " used " + palette.size + " colors");
  });
});

test("downscale averages blocks, keeps the aspect and handles partial edge blocks", () => {
  const { downscale } = require("../src/engine/downscale");
  const data = new Uint8Array(5 * 3 * 4);
  for (let i = 0; i < 15; i++) data.set([i < 5 ? 0 : 200, 100, 50, 255], i * 4);
  const out = downscale({ width: 5, height: 3, components: 4, data }, 2);
  assert.equal(out.width, 3);
  assert.equal(out.height, 2);
  assert.equal(out.data.length, 3 * 2 * 4);
  assert.deepEqual(Array.from(out.data.slice(0, 4)), [100, 100, 50, 255]);
  assert.deepEqual(Array.from(out.data.slice(8, 12)), [100, 100, 50, 255]);
  assert.deepEqual(Array.from(out.data.slice(12, 16)), [200, 100, 50, 255]);
  assert.equal(downscale({ width: 5, height: 3, components: 4, data }, 1).data, data);
});

test("downscale does not let transparent pixels darken the colors", () => {
  const { downscale } = require("../src/engine/downscale");
  const data = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 0]);
  const out = downscale({ width: 2, height: 1, components: 4, data }, 2);
  assert.deepEqual(Array.from(out.data), [255, 255, 255, 128]);
});
