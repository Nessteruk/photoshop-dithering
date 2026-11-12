const test = require("node:test");
const assert = require("node:assert/strict");

function fakeElement(tag) {
  const listeners = {};
  const element = {
    tagName: tag,
    children: [],
    attributes: {},
    className: "",
    textContent: "",
    value: "",
    parentNode: null,
    classList: {
      add(name) {
        if (!element.classList.contains(name)) element.className = (element.className + " " + name).trim();
      },
      remove(name) {
        element.className = element.className.split(/\s+/).filter((entry) => entry && entry !== name).join(" ");
      },
      contains: (name) => element.className.split(/\s+/).indexOf(name) !== -1
    },
    get firstChild() {
      return element.children[0] || null;
    },
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    removeChild(child) {
      element.children.splice(element.children.indexOf(child), 1);
      return child;
    },
    setAttribute(name, value) {
      element.attributes[name] = value;
    },
    getAttribute: (name) => element.attributes[name],
    addEventListener(type, handler) {
      (listeners[type] = listeners[type] || []).push(handler);
    },
    fire(type, event) {
      (listeners[type] || []).forEach((handler) => handler(Object.assign({ target: element }, event)));
    }
  };
  return element;
}

global.document = { createElement: fakeElement };

const settingsApi = require("../src/core/settings");
const components = require("../src/ui/components");
const { buildControl } = require("../src/ui/controls");

function recorder(settings) {
  const calls = [];
  return { calls, api: { get: (key) => settings[key], set: (key, value) => calls.push([key, value]) } };
}

test("every parameter of the schema builds a control that can display its settings", () => {
  const settings = settingsApi.defaults();
  settingsApi.PARAMS.forEach((param) => {
    const { api } = recorder(settings);
    const control = buildControl(param, api);
    assert.ok(control.element, param.key);
    control.update(settings);
  });
});

test("a checkbox reports the new value and can be set", () => {
  const values = [];
  const box = components.checkbox("Label", (checked) => values.push(checked));
  assert.equal(box.input.attributes.size, "s");
  assert.equal(box.element.children[0], box.input);
  box.set(true);
  assert.equal(box.get(), true);
  box.input.fire("change", { target: { checked: false } });
  assert.deepEqual(values, [false]);
});

test("a slider reports numbers inside its bounds and ignores repeats", () => {
  const values = [];
  const slider = components.slider({ label: "L", min: 0, max: 10, step: 1, unit: " px" }, (value) => values.push(value));
  const control = slider.element.children[1].children[0];
  const field = slider.element.children[0].children[1];
  assert.equal(field.attributes.size, "s");
  control.fire("input", { target: { value: "4" } });
  control.fire("input", { target: { value: "4" } });
  field.value = "99";
  field.fire("change");
  field.value = "abc";
  field.fire("change");
  assert.deepEqual(values, [4, 10]);
  assert.equal(field.value, "10 px");
});

test("a select can be refilled and keeps its value", () => {
  const select = components.select([{ value: "a", label: "A" }], () => {});
  select.setOptions([{ value: "", label: "None" }, { value: "b", label: "B" }], "b");
  assert.equal(select.element.children.length, 2);
  assert.equal(select.element.value, "b");
});

test("a text field commits on change and on Enter", () => {
  const values = [];
  const field = components.textField({}, (value) => values.push(value));
  field.set("abc");
  field.element.fire("change");
  field.element.fire("keydown", { key: "Enter" });
  field.element.fire("keydown", { key: "a" });
  assert.deepEqual(values, ["abc", "abc"]);
  assert.equal(field.element.attributes.size, "s");
});

test("a choice reports the picked value, can be set, and rebuilt with other options", () => {
  const values = [];
  const group = components.choice([{ value: "a", label: "A" }, { value: "b", label: "B" }], (value) => values.push(value));
  assert.equal(group.element.tagName, "sp-action-group");
  assert.equal(group.element.attributes.selects, "single");
  assert.deepEqual(group.element.children.map((item) => item.attributes.value), ["a", "b"]);
  group.set("b");
  assert.deepEqual(group.element.selected, ["b"]);
  group.element.selected = ["a"];
  group.element.fire("change");
  assert.deepEqual(values, ["a"]);
  group.setOptions([{ value: "x", label: "X" }], "");
  assert.equal(group.element.children.length, 1);
  assert.deepEqual(group.element.selected, []);
  group.element.selected = [];
  group.element.fire("change");
  assert.deepEqual(values, ["a"]);
});

test("a section collapses when its title is pressed", () => {
  const section = components.section("Title", fakeElement("div"));
  const header = section.children[0];
  header.fire("click");
  assert.ok(section.classList.contains("collapsed"));
  header.fire("click");
  assert.ok(!section.classList.contains("collapsed"));
});

test("an action button is small and only reacts while it is enabled", () => {
  let pressed = 0;
  const button = components.button("Go", () => pressed++);
  assert.equal(button.tagName, "sp-action-button");
  assert.equal(button.attributes.size, "s");
  button.fire("click");
  button.classList.add("disabled");
  button.fire("click");
  assert.equal(pressed, 1);
});

test("a divider is small", () => {
  assert.equal(components.divider().attributes.size, "s");
});
