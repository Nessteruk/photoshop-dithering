const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../src/core/settings");
const { SECTIONS } = require("../src/core/schema");
const { ALGORITHMS, getAlgorithm } = require("../src/algorithms");
const { LOCALES } = require("../src/i18n");

test("defaults are stable under sanitize", () => {
  assert.deepEqual(settings.sanitize(settings.defaults()), settings.defaults());
});

test("sanitize clamps numbers and rejects invalid values", () => {
  const result = settings.sanitize({
    cellSize: 999,
    contrast: "x",
    matrix: "99",
    levels: 1,
    colorMode: "rainbow",
    algorithm: "missing"
  });
  assert.equal(result.cellSize, 64);
  assert.equal(result.contrast, 50);
  assert.equal(result.matrix, "4");
  assert.equal(result.levels, 2);
  assert.equal(result.colorMode, "gray");
  assert.equal(result.algorithm, ALGORITHMS[0].id);
});

test("sanitize ignores unknown keys and non-objects", () => {
  assert.deepEqual(settings.sanitize(null), settings.defaults());
  assert.equal("unknown" in settings.sanitize({ unknown: 1 }), false);
});

test("parameter keys are unique", () => {
  const keys = settings.PARAMS.map((param) => param.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("every parameter is well formed", () => {
  settings.PARAMS.forEach((param) => {
    assert.ok(SECTIONS.includes(param.section), param.key + " has an unknown section");
    assert.ok(settings.VALUE_TYPES.includes(param.type), param.key + " has an unknown type");
    if (param.type === "slider") {
      assert.ok(param.min < param.max && param.default >= param.min && param.default <= param.max, param.key);
    }
    if (param.type === "choice" || param.type === "select") {
      assert.ok(param.options.some((option) => option.value === param.default), param.key);
    }
  });
});

test("algorithms declare an id and parameters", () => {
  assert.ok(ALGORITHMS.length > 0);
  ALGORITHMS.forEach((algorithm) => {
    assert.equal(typeof algorithm.id, "string");
    assert.ok(Array.isArray(algorithm.params));
    assert.equal(getAlgorithm(algorithm.id), algorithm);
  });
  assert.equal(getAlgorithm("missing"), ALGORITHMS[0]);
});

test("the Colors section lists the mode first, then the levels, then the channel offset", () => {
  assert.deepEqual(settings.paramsForSection("colors").map((param) => param.key), ["colorMode", "levels", "channelAngle"]);
});

test("every locale defines the same keys", () => {
  const reference = Object.keys(LOCALES.en).sort();
  Object.keys(LOCALES).forEach((code) => {
    assert.deepEqual(Object.keys(LOCALES[code]).sort(), reference, code);
  });
});

test("every parameter, section, option and algorithm has a translation", () => {
  const keys = new Set(Object.keys(LOCALES.en));
  settings.PARAMS.forEach((param) => {
    assert.ok(keys.has("param." + param.key), "param." + param.key);
    if (param.type === "choice" || param.type === "select") {
      param.options.forEach((option) => assert.ok(keys.has("option." + param.key + "." + option.value), option.value));
    }
  });
  SECTIONS.forEach((section) => assert.ok(keys.has("section." + section), section));
  ALGORITHMS.forEach((algorithm) => assert.ok(keys.has("algorithm." + algorithm.id), algorithm.id));
});

test("a text parameter keeps its string, cut to its maximum length", () => {
  const param = { key: "seed", type: "text", default: "", maxLength: 4 };
  const original = settings.PARAMS.slice();
  settings.PARAMS.push(Object.assign({ owner: null, section: "pattern" }, param));
  try {
    assert.equal(settings.sanitize({ seed: "abcdefg" }).seed, "abcd");
    assert.equal(settings.sanitize({ seed: 12 }).seed, "");
    assert.equal(settings.defaults().seed, "");
  } finally {
    settings.PARAMS.length = 0;
    original.forEach((entry) => settings.PARAMS.push(entry));
  }
});
