const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const en = require("../src/locales/en");
const settingsApi = require("../src/core/settings");
const { CONTROL_TYPES } = require("../src/ui/controls");

function listScripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listScripts(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

const scripts = listScripts(path.join(root, "src")).concat(path.join(root, "main.js"));
const code = scripts.map((file) => fs.readFileSync(file, "utf8")).join("\n");

function matches(text, pattern) {
  return Array.from(text.matchAll(pattern), (match) => match[1]);
}

function addClasses(target, values) {
  values.forEach((value) => value.split(/\s+/).forEach((name) => target.add(name)));
}

test("translation keys used in scripts exist", () => {
  matches(code, /\bt\("([^"]+)"\)/g).forEach((key) => {
    assert.ok(key in en, "missing translation: " + key);
  });
});

test("element ids requested by scripts exist in index.html", () => {
  const ids = new Set(matches(html, /\bid="([^"]+)"/g));
  matches(code, /byId\("([^"]+)"\)/g).forEach((id) => {
    assert.ok(ids.has(id), "missing element: " + id);
  });
});

test("every class used in the markup or created by scripts has a CSS rule", () => {
  const classes = new Set();
  addClasses(classes, matches(html, /class="([^"]+)"/g));
  addClasses(classes, matches(code, /create\("[a-z]+", "([^"]+)"/g));
  addClasses(classes, matches(code, /row\("([^"]+)"/g));
  addClasses(classes, matches(code, /classList\.add\("([^"]+)"\)/g));
  addClasses(classes, matches(code, /toggleClass\([^,]+, "([^"]+)"/g));
  const markers = new Set(["linked-only", "unlinked-only"]);
  classes.forEach((name) => {
    if (markers.has(name)) return;
    assert.ok(css.includes("." + name), "no CSS rule for ." + name);
  });
});

test("styles are written in the stylesheet, not on elements", () => {
  scripts.forEach((file) => {
    assert.ok(!/\.style\./.test(fs.readFileSync(file, "utf8")), file + " sets an inline style");
  });
});

test("every parameter type has a value sanitizer and a panel control", () => {
  assert.deepEqual(CONTROL_TYPES.slice().sort(), settingsApi.VALUE_TYPES.slice().sort());
});

test("every error code has a translation and every thrown code is declared", () => {
  const { ERROR_CODES } = require("../src/core/errors");
  ERROR_CODES.forEach((code) => assert.ok(("error." + code) in en, "missing translation: error." + code));
  matches(code, /\bfail\("([^"]+)"\)/g).forEach((thrown) => {
    assert.ok(ERROR_CODES.includes(thrown), "undeclared error code: " + thrown);
  });
});

test("relative requires point to a file, as Photoshop cannot resolve folders", () => {
  scripts.forEach((file) => {
    matches(fs.readFileSync(file, "utf8"), /require\("(\.[^"]+)"\)/g).forEach((request) => {
      const base = path.resolve(path.dirname(file), request);
      const isFile = (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile();
      assert.ok(isFile(base) || isFile(base + ".js"), file + " requires " + request + ", which is not a file");
    });
  });
});

test("every Spectrum Web Component used by the panel is registered in swc.js", () => {
  const registered = fs.readFileSync(path.join(root, "src", "ui", "swc.js"), "utf8");
  const builtIn = new Set(["slider"]);
  new Set(matches(code, /create\("sp-([a-z-]+)"/g)).forEach((name) => {
    if (builtIn.has(name)) return;
    assert.ok(registered.includes("sp-" + name + ".js"), "sp-" + name + " is not imported in swc.js");
  });
});

test("the confirmation dialog is as tall as its text needs, with equal margins", () => {
  const { dialogHeight } = require("../src/ui/confirm");
  const fr = require("../src/locales/fr")["confirm.convertMessage"];
  const enText = en["confirm.convertMessage"];
  assert.equal(dialogHeight(fr), 104);
  assert.equal(dialogHeight(enText), 104);
  assert.ok(dialogHeight("x".repeat(300)) > dialogHeight(fr));
  assert.equal(dialogHeight(""), 86);
});
