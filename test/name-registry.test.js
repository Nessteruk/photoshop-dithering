const test = require("node:test");
const assert = require("node:assert/strict");

const { createNameRegistry } = require("../src/core/name-registry");
const settingsApi = require("../src/core/settings");

const settings = (cellSize) => Object.assign(settingsApi.defaults(), { cellSize });

test("the registry gives back the settings last remembered under a name", () => {
  const registry = createNameRegistry([]);
  registry.remember("Dithering Render", settings(4));
  registry.remember("Dithering Render", settings(9));
  assert.equal(registry.find("Dithering Render").cellSize, 9);
  assert.equal(registry.find("Autre"), null);
});

test("the settings returned are a copy", () => {
  const registry = createNameRegistry([]);
  registry.remember("A", settings(4));
  registry.find("A").cellSize = 50;
  assert.equal(registry.find("A").cellSize, 4);
});

test("the most recent names come first and the list is limited", () => {
  const registry = createNameRegistry([]);
  for (let i = 0; i < 60; i++) registry.remember("Calque " + i, settings(2));
  const names = registry.toArray().map((entry) => entry.name);
  assert.equal(names.length, 50);
  assert.equal(names[0], "Calque 59");
  assert.equal(registry.find("Calque 0"), null);
});

test("stored entries are checked when the registry is loaded", () => {
  const registry = createNameRegistry([{ name: "A", settings: { cellSize: 9999 } }, { name: "", settings: {} }, null, { settings: {} }]);
  assert.equal(registry.toArray().length, 1);
  assert.equal(registry.find("A").cellSize, 64);
  assert.equal(createNameRegistry("broken").toArray().length, 0);
});
