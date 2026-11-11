const test = require("node:test");
const assert = require("node:assert/strict");

const { createLinkHistory } = require("../src/core/link-history");

test("the links of a history state are given back as they were", () => {
  const history = createLinkHistory(10);
  const links = { 5: { contrast: 50 } };
  history.record(1, 700, links);
  links[5].contrast = 60;
  history.record(1, 701, links);
  assert.equal(history.find(1, 700)[5].contrast, 50);
  assert.equal(history.find(1, 701)[5].contrast, 60);
});

test("unknown states, documents and missing links give nothing", () => {
  const history = createLinkHistory(10);
  history.record(1, 700, { 5: {} });
  history.record(1, 701, null);
  history.record(1, undefined, { 5: {} });
  assert.equal(history.find(1, 701), null);
  assert.equal(history.find(2, 700), null);
  assert.equal(history.has(1), true);
  assert.equal(history.has(2), false);
});

test("a copy is returned, so editing it does not change the record", () => {
  const history = createLinkHistory(10);
  history.record(1, 700, { 5: { contrast: 50 } });
  history.find(1, 700)[5].contrast = 99;
  assert.equal(history.find(1, 700)[5].contrast, 50);
});

test("the oldest states are forgotten beyond the limit", () => {
  const history = createLinkHistory(3);
  for (let id = 1; id <= 5; id++) history.record(1, id, { 1: { n: id } });
  assert.equal(history.find(1, 1), null);
  assert.equal(history.find(1, 2), null);
  assert.equal(history.find(1, 5)[1].n, 5);
});
