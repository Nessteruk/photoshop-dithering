const test = require("node:test");
const assert = require("node:assert/strict");

const tree = require("../src/core/layer-tree");
const settingsApi = require("../src/core/settings");

function layer(id, name, layers) {
  return layers ? { id, name, layers } : { id, name };
}

function document() {
  return [
    layer(1, "Texte"),
    layer(2, "Groupe", [layer(3, "Dithering Render"), layer(4, "Détail"), layer(5, "Sous-groupe", [layer(6, "Fond du groupe")])]),
    layer(7, "Photo"),
    layer(8, "Fond")
  ];
}

const ids = (layers) => layers.map((entry) => entry.id);

test("a layer is found at any depth", () => {
  assert.equal(tree.findLayer(document(), 6).name, "Fond du groupe");
  assert.equal(tree.findLayer(document(), 99), null);
});

test("siblings are the layers of the same level", () => {
  assert.deepEqual(ids(tree.siblingsOf(document(), 4)), [3, 4, 5]);
  assert.deepEqual(ids(tree.siblingsOf(document(), 7)), [1, 2, 7, 8]);
  assert.equal(tree.siblingsOf(document(), 99), null);
});

test("layers above a layer at the top level are the ones before it", () => {
  assert.deepEqual(ids(tree.layersAbove(document(), 7)), [1, 2]);
  assert.deepEqual(ids(tree.layersAbove(document(), 1)), []);
});

test("layers above a layer in a group include the layers above the group but not the group itself", () => {
  assert.deepEqual(ids(tree.layersAbove(document(), 4)), [1, 3]);
  assert.deepEqual(ids(tree.layersAbove(document(), 6)), [1, 3, 4]);
  assert.equal(tree.layersAbove(document(), 99), null);
});

test("layers below a layer include everything under it, groups and their children", () => {
  assert.deepEqual(ids(tree.layersBelow(document(), 1)).sort(), [2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(ids(tree.layersBelow(document(), 7)), [8]);
  assert.deepEqual(ids(tree.layersBelow(document(), 8)), []);
});

test("layers below a layer in a group also include what is below the group", () => {
  assert.deepEqual(ids(tree.layersBelow(document(), 3)).sort(), [4, 5, 6, 7, 8]);
  assert.deepEqual(ids(tree.layersBelow(document(), 6)).sort(), [7, 8]);
});

test("a new normal layer takes the smallest free number, like Photoshop", () => {
  const named = (...names) => names.map((name, index) => layer(index + 1, name));
  assert.equal(tree.nextLayerName("Calque", named("Fond")), "Calque 1");
  assert.equal(tree.nextLayerName("Calque", named("Calque 1", "Calque 2")), "Calque 3");
  assert.equal(tree.nextLayerName("Calque", named("Calque 2", "Calque 3")), "Calque 1");
  assert.equal(tree.nextLayerName("Calque", named("Calque 1", "Calque 3")), "Calque 2");
  assert.equal(tree.nextLayerName("Layer", named("Calque 1")), "Layer 1");
});

test("names inside groups are taken into account", () => {
  const layers = [layer(1, "Calque 1"), layer(2, "Groupe", [layer(3, "Calque 2")])];
  assert.equal(tree.nextLayerName("Calque", layers), "Calque 3");
});

test("array-like collections from Photoshop work like arrays", () => {
  const collection = { length: 2, 0: layer(1, "A"), 1: layer(2, "B", { length: 1, 0: layer(3, "C") }) };
  assert.equal(tree.findLayer(collection, 3).name, "C");
  assert.deepEqual(ids(tree.layersBelow(collection, 1)), [2, 3]);
});

test("a snapshot lists every layer once, from the top of the stack down, children included", () => {
  assert.deepEqual(tree.snapshot(document()).map((entry) => entry.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("a snapshot remembers each layer's siblings and position", () => {
  const entry = tree.snapshot(document()).find((candidate) => candidate.id === 4);
  assert.equal(entry.index, 1);
  assert.deepEqual(ids(entry.siblings), [3, 4, 5]);
});

test("a duplicated Dithering layer is recognised by its name, next to its source", () => {
  const layers = [
    layer(1, "Dithering Render copie"),
    layer(2, "Dithering Render"),
    layer(3, "Dithering Render copie"),
    layer(4, "Autre"),
    layer(5, "Dithering Render")
  ];
  const copies = tree.findCopies(tree.snapshot(layers), [2, 5], () => true);
  assert.deepEqual(copies, [{ id: 1, sourceId: 2 }, { id: 3, sourceId: 5 }]);
});

test("only candidates that look like Dithering layers are taken, and the name must continue after a space", () => {
  const layers = [layer(1, "Grain copie"), layer(2, "Grain"), layer(3, "Grainy"), layer(4, "Grain copie 2")];
  const copies = tree.findCopies(tree.snapshot(layers), [2], (candidate) => candidate.id !== 4);
  assert.deepEqual(copies, [{ id: 1, sourceId: 2 }]);
  assert.deepEqual(tree.findCopies(tree.snapshot(layers), [], () => true), []);
});

test("counting hidden layers is a saved setting in the Source section, off by default", () => {
  const param = settingsApi.PARAMS.find((candidate) => candidate.key === "includeHidden");
  assert.equal(param.section, "source");
  assert.equal(param.type, "checkbox");
  assert.equal(settingsApi.defaults().includeHidden, false);
  assert.deepEqual(settingsApi.paramsForSection("source").map((entry) => entry.key), ["autoUpdate", "includeHidden"]);
});
