const { createLinkHistory } = require("../core/link-history");
const documentData = require("./document-data");

const history = createLinkHistory(300);

function record(documentId, stateId) {
  history.record(documentId, stateId, documentData.peek(documentId));
}

function baseline(doc) {
  if (history.has(doc.id) || !doc.activeHistoryState) return;
  record(doc.id, doc.activeHistoryState.id);
}

module.exports = { record, baseline, find: history.find };
