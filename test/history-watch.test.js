const test = require("node:test");
const assert = require("node:assert/strict");

const { createHistoryWatcher } = require("../src/core/history-watch");
const settingsApi = require("../src/core/settings");

const kind = (watcher, id, stateId, name) => watcher.observe(id, stateId, name).kind;

test("a new history state from the user is a change", () => {
  const watcher = createHistoryWatcher("Dithering");
  assert.equal(kind(watcher, 1, 600, "Brush Tool"), "change");
  assert.equal(kind(watcher, 1, 601, "Layer Visibility"), "change");
});

test("the plugin's own history state is not a change", () => {
  const watcher = createHistoryWatcher("Dithering");
  assert.equal(kind(watcher, 1, 600, "Dithering"), "own");
  assert.equal(kind(watcher, 1, 601, "Brush Tool"), "change");
});

test("going back to an older state is a jump, not a change", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 670, "Brush Tool");
  watcher.observe(1, 673, "Layer Order");
  assert.equal(kind(watcher, 1, 670, "Brush Tool"), "jump");
  assert.equal(kind(watcher, 1, 673, "Layer Order"), "jump");
  assert.equal(kind(watcher, 1, 680, "Duplicate Layer"), "change");
});

test("states settled after an own render are not reported again whatever their name", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 600, "Brush Tool");
  watcher.settle(1, 605, false);
  assert.equal(kind(watcher, 1, 605, "Renamed by Photoshop"), "jump");
  assert.equal(kind(watcher, 1, 606, "Brush Tool"), "change");
});

test("documents are followed separately and events without an id are ignored", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 700, "Brush Tool");
  assert.equal(kind(watcher, 2, 650, "Brush Tool"), "change");
  assert.equal(kind(watcher, 1, undefined, "Brush Tool"), "ignore");
});

test("one undo lands on the change that an automatic render followed: it is a group, to step back past", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 600, "Brush Tool");
  watcher.observe(1, 601, "Dithering");
  watcher.settle(1, 601, true);
  const result = watcher.observe(1, 600, "Brush Tool");
  assert.equal(result.kind, "group");
  assert.equal(result.direction, "undo");
  assert.deepEqual(result.group, { change: 600, render: 601 });
});

test("a redo lands on the same change and goes forward to the render", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 600, "Brush Tool");
  watcher.observe(1, 601, "Dithering");
  watcher.settle(1, 601, true);
  watcher.settle(1, 590, false);
  const result = watcher.observe(1, 600, "Brush Tool");
  assert.equal(result.kind, "group");
  assert.equal(result.direction, "redo");
});

test("a manual render is not a group: undoing it lands normally on the previous state", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 600, "Brush Tool");
  watcher.observe(1, 601, "Dithering");
  watcher.settle(1, 601, false);
  assert.equal(kind(watcher, 1, 600, "Brush Tool"), "jump");
});

test("a forgotten group is no longer reported", () => {
  const watcher = createHistoryWatcher("Dithering");
  watcher.observe(1, 600, "Brush Tool");
  watcher.observe(1, 601, "Dithering");
  watcher.settle(1, 601, true);
  const group = watcher.observe(1, 600, "Brush Tool").group;
  watcher.forget(1, group);
  watcher.settle(1, 601, false);
  assert.equal(kind(watcher, 1, 600, "Brush Tool"), "jump");
});

test("automatic update is a saved setting in the Source section, on by default", () => {
  const param = settingsApi.PARAMS.find((candidate) => candidate.key === "autoUpdate");
  assert.equal(param.section, "source");
  assert.equal(param.type, "checkbox");
  assert.equal(settingsApi.defaults().autoUpdate, true);
});
