const test = require("node:test");
const assert = require("node:assert/strict");

const { SPECTRUM_COLOR } = require("../src/ui/theme");

test("every Photoshop theme maps to a Spectrum color scheme that exists in sp-theme", () => {
  const known = ["light", "lightest", "dark", "darkest"];
  assert.deepEqual(Object.keys(SPECTRUM_COLOR).sort(), ["dark", "darkest", "light", "lightest"]);
  Object.values(SPECTRUM_COLOR).forEach((color) => assert.ok(known.includes(color), color));
});

test("styles.css defines a palette for every Photoshop theme", () => {
  const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "styles.css"), "utf8");
  Object.keys(SPECTRUM_COLOR).forEach((theme) => assert.ok(css.includes('sp-theme[data-theme="' + theme + '"]'), theme));
});
