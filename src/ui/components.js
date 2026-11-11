const { create, clear, toggleClass, onPress } = require("./dom");

const SIZE = "s";

function formatNumber(config, value) {
  const text = config.decimals ? value.toFixed(config.decimals).replace(".", ",") : String(Math.round(value));
  return text + (config.unit || "");
}

function parseNumber(text) {
  const number = parseFloat(String(text).replace(",", "."));
  return isFinite(number) ? number : null;
}

function sized(element) {
  element.setAttribute("size", SIZE);
  return element;
}

function button(label, onActivate) {
  const element = sized(create("sp-action-button", "grow", label));
  if (onActivate) onPress(element, onActivate);
  return element;
}

function checkbox(label, onChange) {
  const element = sized(create("sp-checkbox", "", label));
  element.addEventListener("change", (event) => {
    if (onChange) onChange(Boolean(event.target.checked));
  });
  return {
    element,
    set(value) {
      element.checked = Boolean(value);
    },
    get: () => Boolean(element.checked)
  };
}

function fillChoices(group, options) {
  clear(group);
  options.forEach((option) => {
    const item = sized(create("sp-action-button", "grow", option.label));
    item.setAttribute("value", option.value);
    group.appendChild(item);
  });
}

function choice(options, onChange, vertical) {
  const element = sized(create("sp-action-group", "grow"));
  element.setAttribute("selects", "single");
  element.setAttribute("justified", "");
  if (vertical) element.setAttribute("vertical", "");
  fillChoices(element, options);
  element.addEventListener("change", () => {
    const value = element.selected && element.selected[0];
    if (value !== undefined && onChange) onChange(value);
  });
  return {
    element,
    set(value) {
      element.selected = value === "" || value === null || value === undefined ? [] : [value];
    },
    setOptions(next, value) {
      fillChoices(element, next);
      element.selected = value ? [value] : [];
    }
  };
}

function select(options, onChange) {
  const element = create("select", "select grow");
  const fill = (entries) => {
    clear(element);
    entries.forEach((entry) => {
      const option = create("option", "", entry.label);
      option.value = entry.value;
      element.appendChild(option);
    });
  };
  fill(options);
  element.addEventListener("change", (event) => onChange(event.target.value));
  return {
    element,
    set(value) {
      element.value = value;
    },
    setOptions(next, value) {
      fill(next);
      element.value = value;
    }
  };
}

function textField(config, onCommit) {
  const element = sized(create("sp-textfield", "text-input" + (config.wide ? " wide" : "")));
  if (config.placeholder) element.setAttribute("placeholder", config.placeholder);
  const commit = () => {
    if (onCommit) onCommit(element.value);
  };
  element.addEventListener("change", commit);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commit();
  });
  return {
    element,
    set(value) {
      element.value = value;
    },
    get: () => element.value
  };
}

function slider(config, onChange) {
  const element = create("div", "slider-row");
  const header = create("div", "line");
  const field = sized(create("sp-textfield", "text-input value-field"));
  header.appendChild(create("span", "label", config.label));
  header.appendChild(field);

  const control = document.createElement("sp-slider");
  control.setAttribute("min", String(config.min));
  control.setAttribute("max", String(config.max));
  control.setAttribute("step", String(config.step || 1));
  control.setAttribute("value", String(config.min));
  control.setAttribute("show-value", "false");

  const rail = create("div", "slider-rail");
  rail.appendChild(control);
  element.appendChild(header);
  element.appendChild(rail);

  let current = config.min;
  let shown = null;
  const show = (value) => {
    if (value === shown) return;
    shown = value;
    current = value;
    field.value = formatNumber(config, value);
    control.value = value;
  };
  const change = (value) => {
    if (value !== current) {
      current = value;
      onChange(value);
    }
  };
  control.addEventListener("input", (event) => {
    const number = Number(event.target.value);
    if (isFinite(number)) change(number);
  });
  const commit = () => {
    const number = parseNumber(field.value);
    if (number === null) {
      field.value = formatNumber(config, current);
      return;
    }
    const bounded = Math.min(config.max, Math.max(config.min, number));
    field.value = formatNumber(config, bounded);
    change(bounded);
  };
  field.addEventListener("change", commit);
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commit();
  });
  return { element, set: show };
}

function labeled(label, control) {
  const element = create("div", "text-row");
  element.appendChild(create("span", "label", label));
  element.appendChild(control);
  return element;
}

function row(className, children) {
  const element = create("div", "row" + (className ? " " + className : ""));
  children.forEach((child) => element.appendChild(child));
  return element;
}

function line(label, value) {
  const element = create("div", "line");
  element.appendChild(create("span", "label", label));
  element.appendChild(value);
  return element;
}

function divider() {
  return sized(create("sp-divider", "section-divider"));
}

function section(title, body, className) {
  const element = create("section", "section" + (className ? " " + className : ""));
  const caret = create("span", "caret", "▼");
  const header = create("div", "section-title");
  header.appendChild(caret);
  header.appendChild(create("span", "", title));
  body.classList.add("section-body");
  element.appendChild(header);
  element.appendChild(body);
  header.addEventListener("click", () => {
    const collapse = !element.classList.contains("collapsed");
    toggleClass(element, "collapsed", collapse);
    caret.textContent = collapse ? "▶" : "▼";
  });
  return element;
}

module.exports = { button, checkbox, choice, select, textField, slider, labeled, row, line, divider, section };
