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

test("the scope of a top-level layer is what is above it (outside) and everything below it", () => {
  const scope = tree.scopeOf(document(), 7);
  assert.deepEqual(ids(scope.outside), [1, 2]);
  assert.deepEqual(ids(scope.ancestors), []);
  assert.deepEqual(ids(scope.below), [8]);
  assert.deepEqual(ids(tree.scopeOf(document(), 1).outside), []);
  assert.deepEqual(ids(tree.scopeOf(document(), 1).below).sort(), [2, 3, 4, 5, 6, 7, 8]);
  assert.equal(tree.scopeOf(document(), 99), null);
});

test("the scope of a layer in a group is limited to that group", () => {
  const scope = tree.scopeOf(document(), 3);
  assert.deepEqual(ids(scope.ancestors), [2]);
  assert.deepEqual(ids(scope.below).sort(), [4, 5, 6]);
  assert.deepEqual(ids(scope.outside).sort(), [1, 7, 8]);
});

test("the scope of a layer in a nested group keeps every parent and leaves the other levels out", () => {
  const scope = tree.scopeOf(document(), 6);
  assert.deepEqual(ids(scope.ancestors), [2, 5]);
  assert.deepEqual(ids(scope.below), []);
  assert.deepEqual(ids(scope.outside).sort(), [1, 3, 4, 7, 8]);
});

test("a layer is shown only when it and all its groups are visible", () => {
  const shown = () => [
    { id: 1, visible: true },
    { id: 2, visible: true, layers: [{ id: 3, visible: true }, { id: 4, visible: false }] }
  ];
  assert.equal(tree.isShown(shown(), 1), true);
  assert.equal(tree.isShown(shown(), 3), true);
  assert.equal(tree.isShown(shown(), 4), false);
  const hiddenGroup = shown();
  hiddenGroup[1].visible = false;
  assert.equal(tree.isShown(hiddenGroup, 3), false);
  const hiddenLayer = shown();
  hiddenLayer[0].visible = false;
  assert.equal(tree.isShown(hiddenLayer, 1), false);
  assert.equal(tree.isShown(shown(), 99), false);
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
  assert.deepEqual(ids(tree.scopeOf(collection, 1).below), [2, 3]);
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
