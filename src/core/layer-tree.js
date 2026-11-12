function toArray(layers) {
  const result = [];
  for (let i = 0; i < layers.length; i++) result.push(layers[i]);
  return result;
}

function childrenOf(layer) {
  return layer.layers && layer.layers.length ? toArray(layer.layers) : [];
}

function findLayer(layers, id) {
  const list = toArray(layers);
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
    const found = findLayer(childrenOf(list[i]), id);
    if (found) return found;
  }
  return null;
}

function siblingsOf(layers, id) {
  const list = toArray(layers);
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list;
    const found = siblingsOf(childrenOf(list[i]), id);
    if (found) return found;
  }
  return null;
}

function flatten(layers) {
  const result = [];
  layers.forEach((layer) => {
    result.push(layer);
    flatten(childrenOf(layer)).forEach((child) => result.push(child));
  });
  return result;
}

function scopeOf(layers, id) {
  const list = toArray(layers);
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { outside: list.slice(0, i), ancestors: [], below: flatten(list.slice(i + 1)) };
    const inner = scopeOf(childrenOf(list[i]), id);
    if (inner) {
      return {
        outside: inner.outside.concat(list.filter((layer, index) => index !== i)),
        ancestors: [list[i]].concat(inner.ancestors),
        below: inner.below
      };
    }
  }
  return null;
}

function isShown(layers, id) {
  const scope = scopeOf(layers, id);
  const layer = findLayer(layers, id);
  return Boolean(scope && layer && layer.visible && scope.ancestors.every((ancestor) => ancestor.visible));
}

function snapshot(layers) {
  const entries = [];
  (function walk(items) {
    const siblings = toArray(items);
    siblings.forEach((layer, index) => {
      entries.push({ layer, id: layer.id, siblings, index });
      walk(childrenOf(layer));
    });
  })(layers);
  return entries;
}

function findCopies(entries, linkedIds, isCandidate) {
  const linked = entries.filter((entry) => linkedIds.indexOf(entry.id) !== -1);
  if (!linked.length) return [];
  const linkedNames = linked.map((entry) => entry.layer.name);
  const copies = [];
  entries.forEach((entry) => {
    if (linkedIds.indexOf(entry.id) !== -1) return;
    const name = entry.layer.name;
    const sources = linked.filter((source, i) => name.length > linkedNames[i].length
      && name.indexOf(linkedNames[i]) === 0 && name.charAt(linkedNames[i].length) === " ");
    if (!sources.length || !isCandidate(entry.layer)) return;
    let source = sources[0];
    for (let i = entry.index + 1; i < entry.siblings.length; i++) {
      const match = sources.find((candidate) => candidate.id === entry.siblings[i].id);
      if (match) {
        source = match;
        break;
      }
    }
    copies.push({ id: entry.id, sourceId: source.id });
  });
  return copies;
}

function nextLayerName(prefix, layers) {
  const names = {};
  flatten(toArray(layers)).forEach((layer) => {
    names[layer.name] = true;
  });
  let number = 1;
  while (names[prefix + " " + number]) number++;
  return prefix + " " + number;
}

module.exports = { findLayer, siblingsOf, scopeOf, isShown, snapshot, findCopies, nextLayerName };
