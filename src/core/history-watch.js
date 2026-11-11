const MAX_GROUPS = 50;

function createHistoryWatcher(ownName) {
  const documents = {};

  function of(documentId) {
    if (!documents[documentId]) documents[documentId] = { newest: undefined, active: undefined, lastChange: undefined, groups: [] };
    return documents[documentId];
  }

  function observe(documentId, stateId, name) {
    if (typeof stateId !== "number") return { kind: "ignore" };
    const known = of(documentId);
    const previous = known.active;
    const fresh = known.newest === undefined || stateId > known.newest;
    known.active = stateId;
    if (fresh) {
      known.newest = stateId;
      if (name === ownName) return { kind: "own" };
      known.lastChange = stateId;
      return { kind: "change" };
    }
    const group = known.groups.find((candidate) => candidate.change === stateId);
    if (!group || previous === undefined || previous === stateId) return { kind: "jump" };
    return { kind: "group", direction: previous > stateId ? "undo" : "redo", group };
  }

  function settle(documentId, stateId, grouped) {
    if (typeof stateId !== "number") return;
    const known = of(documentId);
    known.active = stateId;
    if (known.newest === undefined || stateId > known.newest) known.newest = stateId;
    if (grouped && known.lastChange !== undefined && stateId > known.lastChange) {
      known.groups.push({ change: known.lastChange, render: stateId });
      if (known.groups.length > MAX_GROUPS) known.groups.shift();
    }
  }

  function forget(documentId, group) {
    const known = of(documentId);
    known.groups = known.groups.filter((candidate) => candidate !== group);
  }

  return { observe, settle, forget };
}

module.exports = { createHistoryWatcher };
