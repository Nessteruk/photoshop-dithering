const { app } = require("photoshop");
const { readLinked } = require("./effect");

async function readActiveSource() {
  const doc = app.activeDocument;
  if (!doc) return { key: "no-document" };
  const layers = doc.activeLayers;
  if (!layers || layers.length === 0) return { key: "no-layer" };
  const layer = layers[0];
  const settings = await readLinked(doc, layer.id);
  if (settings) return { key: "linked", name: layer.name, link:{ documentId: doc.id, resultId: layer.id, settings } };
  return { key: "ready" };
}

module.exports = { readActiveSource };
