const { app, action } = require("photoshop");
const xmp = require("../core/xmp");
const linksApi = require("../core/links");

const PROPERTY = "XMPMetadataAsUTF8";
const DOCUMENT = { _ref: "document", _enum: "ordinal", _value: "targetEnum" };
const cache = {};

async function play(descriptor) {
  const results = await action.batchPlay([descriptor], {});
  const result = results[0];
  if (result && result._obj === "error") throw new Error(result.message || "batchPlay error");
  return result;
}

async function readXmp() {
  const result = await play({ _obj: "get", _target: [{ _property: PROPERTY }, DOCUMENT] });
  return typeof result[PROPERTY] === "string" ? result[PROPERTY] : "";
}

function isActive(doc) {
  return Boolean(app.activeDocument) && app.activeDocument.id === doc.id;
}

async function load(doc, exists) {
  if (cache[doc.id]) return cache[doc.id];
  let links = {};
  if (isActive(doc)) {
    try {
      links = linksApi.parse(xmp.getValue(await readXmp(), linksApi.FIELD));
    } catch (error) {
      console.error(error);
    }
  }
  if (exists) links = linksApi.prune(links, exists);
  cache[doc.id] = links;
  return links;
}

async function save(doc, links) {
  cache[doc.id] = links;
  if (!isActive(doc)) return false;
  const text = xmp.setValue(await readXmp(), linksApi.FIELD, linksApi.serialize(links));
  await play({ _obj: "set", _target: [{ _property: PROPERTY }, DOCUMENT], to: { _obj: "document", [PROPERTY]: text } });
  return true;
}

function peek(documentId) {
  return cache[documentId] || null;
}

module.exports = { load, save, peek };
