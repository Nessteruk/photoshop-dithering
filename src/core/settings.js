const { COMMON_PARAMS } = require("./schema");
const { ALGORITHMS } = require("../algorithms/index");

function collectParams() {
  const params = COMMON_PARAMS.map((param) => Object.assign({ owner: null }, param));
  ALGORITHMS.forEach((algorithm) => {
    algorithm.params.forEach((param) => params.push(Object.assign({ owner: algorithm.id }, param)));
  });
  const seen = {};
  params.forEach((param) => {
    if (seen[param.key]) throw new Error("Duplicate parameter key: " + param.key);
    seen[param.key] = true;
  });
  return params;
}

const PARAMS = collectParams();

function defaults() {
  const result = { algorithm: ALGORITHMS[0].id };
  PARAMS.forEach((param) => {
    result[param.key] = param.default;
  });
  return result;
}

const VALUE_TYPES = {
  slider: (param, value) => (typeof value === "number" && isFinite(value) ? Math.min(param.max, Math.max(param.min, value)) : param.default),
  choice: (param, value) => (param.options.some((option) => option.value === value) ? value : param.default),
  select: (param, value) => (param.options.some((option) => option.value === value) ? value : param.default),
  checkbox: (param, value) => (typeof value === "boolean" ? value : param.default),
  text: (param, value) => (typeof value === "string" ? value.slice(0, param.maxLength || 256) : param.default)
};

function sanitizeValue(param, value) {
  const sanitizer = VALUE_TYPES[param.type];
  return sanitizer ? sanitizer(param, value) : param.default;
}

function sanitize(input) {
  const source = input && typeof input === "object" ? input : {};
  const result = defaults();
  PARAMS.forEach((param) => {
    if (Object.prototype.hasOwnProperty.call(source, param.key)) {
      result[param.key] = sanitizeValue(param, source[param.key]);
    }
  });
  if (ALGORITHMS.some((algorithm) => algorithm.id === source.algorithm)) result.algorithm = source.algorithm;
  return result;
}

function paramsForSection(section) {
  return PARAMS.filter((param) => param.section === section)
    .map((param, index) => ({ param, index }))
    .sort((a, b) => (a.param.order || 0) - (b.param.order || 0) || a.index - b.index)
    .map((entry) => entry.param);
}

function isVisible(param, settings) {
  if (param.owner !== null && param.owner !== settings.algorithm) return false;
  if (param.hideWhen && param.hideWhen.values.indexOf(settings[param.hideWhen.key]) !== -1) return false;
  return true;
}

module.exports = { PARAMS, VALUE_TYPES: Object.keys(VALUE_TYPES), defaults, sanitize, paramsForSection, isVisible };
