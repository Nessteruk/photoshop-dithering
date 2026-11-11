const settingsApi = require("./settings");

const VERSION = 1;
const FIELD = "links";

function parse(text) {
  const links = {};
  if (!text) return links;
  try {
    const data = JSON.parse(text);
    if (data && data.v === VERSION && data.layers && typeof data.layers === "object") {
      Object.keys(data.layers).forEach((id) => {
        links[id] = settingsApi.sanitize(data.layers[id]);
      });
    }
  } catch (error) {
    return {};
  }
  return links;
}

function serialize(links) {
  return JSON.stringify({ v: VERSION, layers: links });
}

function prune(links, exists) {
  const kept = {};
  Object.keys(links).forEach((id) => {
    if (exists(id)) kept[id] = links[id];
  });
  return kept;
}

module.exports = { FIELD, parse, serialize, prune };
