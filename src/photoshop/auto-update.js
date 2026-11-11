const { app, core, action } = require("photoshop");
const { createHistoryWatcher } = require("../core/history-watch");
const tree = require("../core/layer-tree");
const linkHistory = require("./link-history");

const OWN_STATE_NAME = "Dithering";
const DELAY = 600;
const JUMP_DELAY = 100;
const BUSY_DELAY = 800;
const BUSY_RETRIES = 5;
const MAX_SELECTIONS = 50;
const EVENT = "historyStateChanged";

const watcher = createHistoryWatcher(OWN_STATE_NAME);
const timers = {};
const selections = {};
const deferred = {};
const newLayerEvents = {};
const jumpTimers = {};
const JUMP_SETTLE = 300;
const NEW_LAYER_STATE = /duplicate|paste|via copy|via cut|place/i;
let started = false;

function schedule(documentId, onChange, newLayers) {
  clearTimeout(timers[documentId]);
  newLayerEvents[documentId] = Boolean(newLayerEvents[documentId] || newLayers);
  timers[documentId] = setTimeout(() => {
    delete timers[documentId];
    const fresh = newLayerEvents[documentId];
    delete newLayerEvents[documentId];
    if (activeDocument(documentId)) onChange(documentId, fresh);
    else deferred[documentId] = { onChange, fresh: Boolean(fresh || (deferred[documentId] && deferred[documentId].fresh)) };
  }, DELAY);
}

function scheduleJump(documentId, onJump, stateId) {
  clearTimeout(jumpTimers[documentId]);
  jumpTimers[documentId] = setTimeout(() => {
    delete jumpTimers[documentId];
    if (activeDocument(documentId)) onJump(documentId, stateId);
  }, JUMP_SETTLE);
}

function flush() {
  const doc = app.activeDocument;
  if (!doc || !deferred[doc.id]) return;
  const { onChange, fresh } = deferred[doc.id];
  delete deferred[doc.id];
  onChange(doc.id, fresh);
}

function activeDocument(documentId) {
  const doc = app.activeDocument;
  return doc && doc.id === documentId ? doc : null;
}

function findState(doc, stateId) {
  const states = doc.historyStates;
  for (let i = 0; i < states.length; i++) {
    if (states[i].id === stateId) return { index: i, state: states[i] };
  }
  return null;
}

function settle(documentId, grouped) {
  try {
    const doc = activeDocument(documentId);
    if (!doc || !doc.activeHistoryState) return;
    watcher.settle(documentId, doc.activeHistoryState.id, Boolean(grouped));
    linkHistory.record(documentId, doc.activeHistoryState.id);
  } catch (error) {
    console.error(error);
  }
}

function rememberSelection(documentId, stateId) {
  try {
    const doc = activeDocument(documentId);
    if (!doc) return;
    const ids = [];
    for (let i = 0; i < doc.activeLayers.length; i++) ids.push(doc.activeLayers[i].id);
    if (!selections[documentId]) selections[documentId] = {};
    const remembered = selections[documentId];
    remembered[stateId] = ids;
    const keys = Object.keys(remembered);
    if (keys.length > MAX_SELECTIONS) delete remembered[keys[0]];
  } catch (error) {
    console.error(error);
  }
}

async function restoreSelection(doc, ids) {
  const existing = (ids || []).filter((id) => tree.findLayer(doc.layers, id));
  if (!existing.length) return;
  const commands = existing.map((id, index) => {
    const command = { _obj: "select", _target: [{ _ref: "layer", _id: id }], makeVisible: false };
    if (index > 0) command.selectionModifier = { _enum: "selectionModifierType", _value: "addToSelection" };
    return command;
  });
  await action.batchPlay(commands, {});
}

async function moveTo(doc, state, selection) {
  await core.executeAsModal(async () => {
    doc.activeHistoryState = state;
    await restoreSelection(doc, selection);
  }, { commandName: "Dithering" });
}

async function jump(documentId, group, direction, attempt) {
  try {
    const doc = activeDocument(documentId);
    if (!doc) return;
    const render = findState(doc, group.render);
    const change = findState(doc, group.change);
    if (!render || !change) {
      watcher.forget(documentId, group);
      return;
    }
    const target = direction === "undo" ? (change.index > 0 ? doc.historyStates[change.index - 1] : null) : render.state;
    if (!target) return;
    await moveTo(doc, target, (selections[documentId] || {})[group.change]);
    watcher.settle(documentId, target.id, false);
  } catch (error) {
    if (/modal state/i.test(String(error && error.message)) && attempt < BUSY_RETRIES) {
      setTimeout(() => jump(documentId, group, direction, attempt + 1), BUSY_DELAY);
      return;
    }
    console.error(error);
  }
}

async function start(onChange, onJump) {
  if (started) return;
  started = true;
  await action.addNotificationListener([{ event: EVENT }], (name, descriptor) => {
    if (!descriptor) return;
    const documentId = descriptor.documentID;
    const result = watcher.observe(documentId, descriptor.ID, descriptor.name);
    if (result.kind === "change") {
      rememberSelection(documentId, descriptor.ID);
      schedule(documentId, onChange, NEW_LAYER_STATE.test(String(descriptor.name)));
    }
    else if (result.kind === "group") setTimeout(() => jump(documentId, result.group, result.direction, 0), JUMP_DELAY);
    if (result.kind === "change" || result.kind === "own") linkHistory.record(documentId, descriptor.ID);
    if (result.kind === "jump" || result.kind === "group") scheduleJump(documentId, onJump, descriptor.ID);
  });
}

module.exports = { start, settle, flush };
