const test = require("node:test");
const assert = require("node:assert/strict");

const links = require("../src/core/links");
const settingsApi = require("../src/core/settings");
const xmp = require("../src/core/xmp");

test("links survive serialization and the XMP round trip", () => {
  const stored = { 5: settingsApi.sanitize({ algorithm: "bayer", matrix: "8", cellSize: 6 }), 12: settingsApi.defaults() };
  const packet = xmp.setValue("", links.FIELD, links.serialize(stored));
  const loaded = links.parse(xmp.getValue(packet, links.FIELD));
  assert.deepEqual(loaded, stored);
});

test("parse returns an empty map for missing or broken data", () => {
  assert.deepEqual(links.parse(null), {});
  assert.deepEqual(links.parse(""), {});
  assert.deepEqual(links.parse("{not json"), {});
  assert.deepEqual(links.parse(JSON.stringify({ v: 99, layers: { 1: {} } })), {});
  assert.deepEqual(links.parse(JSON.stringify({ v: 1, layers: "x" })), {});
});

test("parse repairs stored settings with sanitize", () => {
  const loaded = links.parse(JSON.stringify({ v: 1, layers: { 3: { cellSize: 9999, algorithm: "unknown", removedSetting: 1 } } }));
  assert.equal(loaded[3].cellSize, 64);
  assert.equal(loaded[3].algorithm, settingsApi.defaults().algorithm);
  assert.equal("removedSetting" in loaded[3], false);
});

test("prune keeps only the links whose layer still exists", () => {
  const kept = links.prune({ 1: { a: 1 }, 2: { a: 2 }, 3: { a: 3 } }, (id) => id !== "2");
  assert.deepEqual(Object.keys(kept), ["1", "3"]);
});
