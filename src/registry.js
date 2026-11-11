const storageApi = require("./storage");
const { createNameRegistry } = require("./core/name-registry");

const KEY = "nameRegistry";
const registry = createNameRegistry(storageApi.read(KEY, []));

function remember(name, settings) {
  if (registry.remember(name, settings)) storageApi.write(KEY, registry.toArray());
}

module.exports = { remember, find: registry.find };
