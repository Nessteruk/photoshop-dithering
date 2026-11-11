const settingsApi = require("./settings");

const LIMIT = 50;

function createNameRegistry(entries) {
  let list = Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry.name === "string" && entry.name).map((entry) => ({
      name: entry.name,
      settings: settingsApi.sanitize(entry.settings)
    }))
    : [];

  function remember(name, settings) {
    if (!name) return false;
    const clean = settingsApi.sanitize(settings);
    if (list.length && list[0].name === name && JSON.stringify(list[0].settings) === JSON.stringify(clean)) return false;
    list = list.filter((entry) => entry.name !== name);
    list.unshift({ name, settings: clean });
    if (list.length > LIMIT) list.length = LIMIT;
    return true;
  }

  function find(name) {
    const entry = list.find((candidate) => candidate.name === name);
    return entry ? Object.assign({}, entry.settings) : null;
  }

  function toArray() {
    return list.slice();
  }

  return { remember, find, toArray };
}

module.exports = { createNameRegistry };
