function createLinkHistory(limit) {
  const documents = {};

  function of(documentId) {
    if (!documents[documentId]) documents[documentId] = { texts: {}, order: [] };
    return documents[documentId];
  }

  function record(documentId, stateId, links) {
    if (!links || typeof stateId !== "number") return;
    const entry = of(documentId);
    if (!(stateId in entry.texts)) entry.order.push(stateId);
    entry.texts[stateId] = JSON.stringify(links);
    while (entry.order.length > limit) delete entry.texts[entry.order.shift()];
  }

  function find(documentId, stateId) {
    const entry = documents[documentId];
    const text = entry && entry.texts[stateId];
    return text ? JSON.parse(text) : null;
  }

  function has(documentId) {
    return Boolean(documents[documentId]);
  }

  return { record, find, has };
}

module.exports = { createLinkHistory };
