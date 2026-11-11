const components = require("./components");
const { t } = require("../i18n");

const label = (param) => t("param." + param.key);

const optionLabels = (param) => param.options.map((option) => ({
  value: option.value,
  label: t("option." + param.key + "." + option.value)
}));

const BUILDERS = {
  slider(param, api) {
    const slider = components.slider(Object.assign({ label: label(param) }, param), (value) => api.set(param.key, value));
    return { element: slider.element, update: (settings) => slider.set(settings[param.key]) };
  },

  choice(param, api) {
    const group = components.choice(optionLabels(param), (value) => api.set(param.key, value));
    return { element: group.element, update: (settings) => group.set(settings[param.key]) };
  },

  select(param, api) {
    const select = components.select(optionLabels(param), (value) => api.set(param.key, value));
    return { element: select.element, update: (settings) => select.set(settings[param.key]) };
  },

  checkbox(param, api) {
    const checkbox = components.checkbox(label(param), (checked) => api.set(param.key, checked));
    return { element: checkbox.element, update: (settings) => checkbox.set(settings[param.key]) };
  },

  text(param, api) {
    const field = components.textField({ maxLength: param.maxLength, wide: true }, (value) => api.set(param.key, value));
    return {
      element: components.labeled(label(param), field.element),
      update: (settings) => field.set(settings[param.key])
    };
  }
};

function buildControl(param, api) {
  const builder = BUILDERS[param.type];
  if (!builder) throw new Error("Unknown parameter type: " + param.type);
  return builder(param, api);
}

module.exports = { buildControl, CONTROL_TYPES: Object.keys(BUILDERS) };
