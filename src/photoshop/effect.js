const { app, core, constants, imaging, action } = require("photoshop");
const { render } = require("../engine/render");
const { downscale } = require("../engine/downscale");
const { getReadScale } = require("../algorithms/index");
const documentData = require("./document-data");
const tree = require("../core/layer-tree");
const registry = require("../registry");
const linkHistory = require("./link-history");
const { t } = require("../i18n");

const RESULT_NAME = "Dithering Render";
const RENDER_COLOR = "red";
const NO_COLOR = "none";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function findDocument(documentId) {
  const active = app.activeDocument;
  if (active && active.id === documentId) return active;
  for (let i = 0; i < app.documents.length; i++) {
    if (app.documents[i].id === documentId) return app.documents[i];
  }
  return null;
}

function pixels(value) {
  const number = typeof value === "number" ? value : Number(value && value.value);
  return Math.round(number);
}

function canvasBounds(doc) {
  return { left: 0, top: 0, right: pixels(doc.width), bottom: pixels(doc.height) };
}

function layerBounds(layer) {
  const bounds = layer.boundsNoEffects || layer.bounds;
  return {
    left: Math.round(bounds.left),
    top: Math.round(bounds.top),
    right: Math.round(bounds.right),
    bottom: Math.round(bounds.bottom)
  };
}

function intersect(a, b) {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom)
  };
}

function isEmpty(bounds) {
  return bounds.right <= bounds.left || bounds.bottom <= bounds.top;
}

function bitDepth(doc) {
  const depth = parseInt(String(doc.bitsPerChannel).replace(/\D/g, ""), 10);
  return depth || 8;
}

function toBuffer(rgba, depth) {
  if (depth === 8) return rgba;
  if (depth === 16) {
    const buffer = new Uint16Array(rgba.length);
    for (let i = 0; i < rgba.length; i++) buffer[i] = Math.round((rgba[i] * 32768) / 255);
    return buffer;
  }
  return fail("unsupported-depth");
}

async function readPixels(doc, sourceLayer, bounds, scale) {
  const options = { documentID: doc.id, sourceBounds: bounds, colorSpace: "RGB", componentSize: 8 };
  if (sourceLayer) options.layerID = sourceLayer.id;
  const result = await imaging.getPixels(options);
  const imageData = result.imageData;
  try {
    const data = new Uint8Array(await imageData.getData({ chunky: true }));
    const returned = result.sourceBounds || bounds;
    const image = { width: imageData.width, height: imageData.height, components: imageData.components, data };
    return {
      image: downscale(image, scale),
      bounds: {
        left: Math.round(returned.left),
        top: Math.round(returned.top),
        right: Math.round(returned.left) + imageData.width,
        bottom: Math.round(returned.top) + imageData.height
      }
    };
  } finally {
    imageData.dispose();
  }
}

async function renderPixels(doc, sourceLayer, settings) {
  const wanted = sourceLayer ? intersect(layerBounds(sourceLayer), canvasBounds(doc)) : canvasBounds(doc);
  if (isEmpty(wanted)) fail("empty-source");
  const { image, bounds } = await readPixels(doc, sourceLayer, wanted, getReadScale(settings));
  const outputBounds = intersect(bounds, canvasBounds(doc));
  if (isEmpty(outputBounds)) fail("empty-source");
  const size = { width: outputBounds.right - outputBounds.left, height: outputBounds.bottom - outputBounds.top };
  const rendered = render(image, size, settings);
  return { width: size.width, height: size.height, rgba: rendered.rgba, left: outputBounds.left, top: outputBounds.top };
}

async function writePixels(doc, layerId, rendered) {
  const buffer = toBuffer(rendered.rgba, bitDepth(doc));
  const imageData = await imaging.createImageDataFromBuffer(buffer, {
    width: rendered.width,
    height: rendered.height,
    components: 4,
    colorSpace: "RGB"
  });
  try {
    await imaging.putPixels({
      documentID: doc.id,
      layerID: layerId,
      imageData,
      replace: true,
      targetBounds: { left: rendered.left, top: rendered.top }
    });
  } finally {
    imageData.dispose();
  }
}

function findBase(doc, resultLayer) {
  const siblings = tree.siblingsOf(doc.layers, resultLayer.id);
  if (!siblings) return null;
  let index = 0;
  while (index < siblings.length && siblings[index].id !== resultLayer.id) index++;
  index++;
  while (index < siblings.length && siblings[index].isClippingMask) index++;
  return index < siblings.length ? siblings[index] : null;
}

async function createResultLayer(doc, referenceLayer) {
  const layer = typeof doc.createPixelLayer === "function"
    ? await doc.createPixelLayer({ name: RESULT_NAME })
    : await doc.createLayer(constants.LayerKind.NORMAL, { name: RESULT_NAME });
  layer.move(referenceLayer, constants.ElementPlacement.PLACEBEFORE);
  return layer;
}

async function setColorLabel(layer, color) {
  try {
    const results = await action.batchPlay([{
      _obj: "set",
      _target: [{ _ref: "layer", _id: layer.id }],
      to: { _obj: "layer", color: { _enum: "color", _value: color } }
    }], {});
    if (results[0] && results[0]._obj === "error") console.error(results[0].message);
  } catch (error) {
    console.error(error);
  }
}

async function setName(layer, name) {
  const results = await action.batchPlay([{
    _obj: "set",
    _target: [{ _ref: "layer", _id: layer.id }],
    to: { _obj: "layer", name }
  }], {});
  if (results[0] && results[0]._obj === "error") throw new Error(results[0].message);
}

const HIDDEN_CHARACTERS = /[​‌‍⁠⁣]/g;

async function cleanName(layer) {
  const clean = layer.name.replace(HIDDEN_CHARACTERS, "");
  if (clean !== layer.name) await setName(layer, clean);
}

async function setLocks(layer, locked) {
  const results = await action.batchPlay([{
    _obj: "applyLocking",
    _target: [{ _ref: "layer", _id: layer.id }],
    layerLocking: {
      _obj: "layerLocking",
      protectAll: false,
      protectTransparency: false,
      protectComposite: locked,
      protectPosition: locked
    }
  }], {});
  if (results[0] && results[0]._obj === "error") throw new Error(results[0].message);
}

const lock = (layer) => setLocks(layer, true);
const unlock = (layer) => setLocks(layer, false);

async function inModal(documentId, commandName, work) {
  return core.executeAsModal(async (context) => {
    const suspension = await context.hostControl.suspendHistory({ documentID: documentId, name: commandName });
    try {
      const result = await work();
      await context.hostControl.resumeHistory(suspension, true);
      return result;
    } catch (error) {
      await context.hostControl.resumeHistory(suspension, false);
      throw error;
    }
  }, { commandName });
}

async function withVisibility(changes, work) {
  const applied = [];
  changes.forEach((change) => {
    if (change.layer.visible !== change.visible) {
      applied.push({ layer: change.layer, previous: change.layer.visible });
      change.layer.visible = change.visible;
    }
  });
  try {
    return await work();
  } finally {
    applied.forEach((entry) => {
      entry.layer.visible = entry.previous;
    });
  }
}

async function renderTarget(doc, resultLayer, settings) {
  if (resultLayer.isClippingMask) {
    const base = findBase(doc, resultLayer);
    if (!base) fail("base-missing");
    return withVisibility([{ layer: base, visible: true }], () => renderPixels(doc, base, settings));
  }
  const scope = tree.scopeOf(doc.layers, resultLayer.id) || { outside: [], ancestors: [], below: [] };
  const changes = scope.outside.concat(resultLayer).map((layer) => ({ layer, visible: false }));
  scope.ancestors.forEach((layer) => changes.push({ layer, visible: true }));
  if (settings.includeHidden) scope.below.forEach((layer) => changes.push({ layer, visible: true }));
  return withVisibility(changes, () => renderPixels(doc, null, settings));
}

async function loadLinks(doc) {
  const links = await documentData.load(doc, (id) => Boolean(tree.findLayer(doc.layers, Number(id))));
  linkHistory.baseline(doc);
  return links;
}

async function readLinked(doc, layerId) {
  const links = await loadLinks(doc);
  return links[layerId] || null;
}

async function addLayer(settings) {
  const doc = app.activeDocument;
  if (!doc) fail("no-document");
  const active = doc.activeLayers.length ? doc.activeLayers[0] : null;
  if (!active) fail("no-layer");
  const links = await loadLinks(doc);
  return inModal(doc.id, "Dithering", async () => {
    const layer = await createResultLayer(doc, active);
    const rendered = await renderTarget(doc, layer, settings);
    await writePixels(doc, layer.id, rendered);
    await lock(layer);
    await setColorLabel(layer, RENDER_COLOR);
    links[layer.id] = Object.assign({}, settings);
    await documentData.save(doc, links);
    return { documentId: doc.id, resultId: layer.id, settings: links[layer.id] };
  });
}

async function renderInto(doc, resultLayer, settings, links) {
  const wasStyled = resultLayer.pixelsLocked;
  await unlock(resultLayer);
  try {
    const rendered = await renderTarget(doc, resultLayer, settings);
    await writePixels(doc, resultLayer.id, rendered);
  } finally {
    await lock(resultLayer);
  }
  if (!wasStyled) await setColorLabel(resultLayer, RENDER_COLOR);
  await cleanName(resultLayer);
  links[resultLayer.id] = Object.assign({}, settings);
}

async function updateLayer(link, settings) {
  const doc = findDocument(link.documentId);
  if (!doc) fail("no-document");
  const resultLayer = tree.findLayer(doc.layers, link.resultId);
  if (!resultLayer) fail("result-missing");
  const links = await loadLinks(doc);
  return inModal(doc.id, "Dithering", async () => {
    await renderInto(doc, resultLayer, settings, links);
    await documentData.save(doc, links);
    link.settings = links[link.resultId];
    return link;
  });
}

function findAdoptions(doc, links, entries) {
  const linkedIds = Object.keys(links).map(Number);
  const isPixel = (layer) => layer.kind === constants.LayerKind.NORMAL;
  const adoptions = {};
  const renderNow = {};
  tree.findCopies(entries, linkedIds, isPixel).forEach((copy) => {
    adoptions[copy.id] = Object.assign({}, links[copy.sourceId]);
  });
  for (let i = 0; i < doc.activeLayers.length; i++) {
    const layer = doc.activeLayers[i];
    if (linkedIds.indexOf(layer.id) !== -1 || adoptions[layer.id] || !isPixel(layer)) continue;
    const settings = registry.find(layer.name);
    if (settings) {
      adoptions[layer.id] = settings;
      renderNow[layer.id] = true;
    }
  }
  return { adoptions, renderNow };
}

async function refreshDocument(documentId, newLayers) {
  const doc = app.activeDocument;
  const idle = { rendered: 0, adopted: false };
  if (!doc || doc.id !== documentId) return idle;
  const links = await loadLinks(doc);
  if (!newLayers && Object.keys(links).length === 0) return idle;
  const entries = tree.snapshot(doc.layers);
  const layers = {};
  entries.forEach((entry) => {
    layers[entry.id] = entry.layer;
  });
  const { adoptions, renderNow } = newLayers ? findAdoptions(doc, links, entries) : { adoptions: {}, renderNow: {} };
  const adopted = Object.keys(adoptions).map(Number);
  const targets = entries.map((entry) => entry.id).reverse().filter((id) => {
    const settings = adoptions[id] ? (renderNow[id] ? adoptions[id] : null) : links[id];
    return Boolean(settings && settings.autoUpdate && tree.isShown(doc.layers, id));
  });
  if (!adopted.length && !targets.length) return idle;
  return inModal(doc.id, "Dithering", async () => {
    for (let i = 0; i < adopted.length; i++) {
      const copy = layers[adopted[i]];
      links[adopted[i]] = adoptions[adopted[i]];
      await lock(copy);
      await setColorLabel(copy, RENDER_COLOR);
      await cleanName(copy);
    }
    for (let i = 0; i < targets.length; i++) {
      await renderInto(doc, layers[targets[i]], Object.assign({}, links[targets[i]]), links);
    }
    await documentData.save(doc, links);
    return { rendered: targets.length, adopted: adopted.length > 0 };
  });
}

async function convertLayer(link) {
  const doc = findDocument(link.documentId);
  if (!doc) fail("no-document");
  const layer = tree.findLayer(doc.layers, link.resultId);
  if (!layer) fail("result-missing");
  const links = await loadLinks(doc);
  return inModal(doc.id, "Dithering", async () => {
    await unlock(layer);
    await setColorLabel(layer, NO_COLOR);
    layer.name = tree.nextLayerName(t("layer.normalName"), doc.layers);
    delete links[link.resultId];
    await documentData.save(doc, links);
  });
}

async function restoreLinks(documentId, stateId) {
  const doc = app.activeDocument;
  if (!doc || doc.id !== documentId) return false;
  const wanted = linkHistory.find(documentId, stateId);
  const current = documentData.peek(documentId);
  if (!wanted || !current || JSON.stringify(wanted) === JSON.stringify(current)) return false;
  await core.executeAsModal(async () => documentData.save(doc, wanted), { commandName: "Dithering" });
  return true;
}

module.exports = { addLayer, updateLayer, convertLayer, refreshDocument, restoreLinks, readLinked };
