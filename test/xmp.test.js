const test = require("node:test");
const assert = require("node:assert/strict");

const xmp = require("../src/core/xmp");

const EXISTING = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">'
  + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
  + '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Adobe Photoshop"/>'
  + '</rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

test("a value written into an empty document can be read back", () => {
  assert.equal(xmp.getValue(xmp.setValue("", "marker", "abc"), "marker"), "abc");
  assert.equal(xmp.getValue(xmp.setValue(null, "marker", "abc"), "marker"), "abc");
});

test("existing metadata is kept when a value is added", () => {
  const result = xmp.setValue(EXISTING, "marker", "abc");
  assert.ok(result.includes('xmp:CreatorTool="Adobe Photoshop"'));
  assert.equal(xmp.getValue(result, "marker"), "abc");
});

test("writing the same field again replaces it instead of duplicating it", () => {
  const once = xmp.setValue(EXISTING, "marker", "one");
  const twice = xmp.setValue(once, "marker", "two");
  assert.equal(xmp.getValue(twice, "marker"), "two");
  assert.equal(twice.split("dith:marker").length - 1, 1);
});

test("different fields live side by side", () => {
  const result = xmp.setValue(xmp.setValue(EXISTING, "settings", "s"), "links", "l");
  assert.equal(xmp.getValue(result, "settings"), "s");
  assert.equal(xmp.getValue(result, "links"), "l");
});

test("special characters and JSON survive the round trip", () => {
  const value = JSON.stringify({ name: 'a "quoted" <tag> & more', list: [1, 2] });
  assert.equal(xmp.getValue(xmp.setValue(EXISTING, "marker", value), "marker"), value);
});

test("a value rewritten by Photoshop as an element is still found", () => {
  const rewritten = EXISTING.replace("</rdf:RDF>", '<rdf:Description xmlns:dith="' + xmp.NAMESPACE_URI + '"><dith:marker>x &amp; y</dith:marker></rdf:Description></rdf:RDF>');
  assert.equal(xmp.getValue(rewritten, "marker"), "x & y");
  assert.equal(xmp.getValue(xmp.setValue(rewritten, "marker", "z"), "marker"), "z");
});

test("a missing field reads as null", () => {
  assert.equal(xmp.getValue(EXISTING, "marker"), null);
  assert.equal(xmp.getValue("", "marker"), null);
  assert.equal(xmp.getValue(undefined, "marker"), null);
});
