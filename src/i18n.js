const LOCALES = {
  en: require("./locales/en"),
  fr: require("./locales/fr")
};

const DEFAULT_LOCALE = "en";

let current = DEFAULT_LOCALE;

function pickLocale(code) {
  const language = String(code || "").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(LOCALES, language) ? language : DEFAULT_LOCALE;
}

function detectLocale() {
  try {
    const code = require("uxp").host.uiLocale;
    if (code) return pickLocale(code);
  } catch (e) {}
  try {
    return pickLocale(navigator.language);
  } catch (e) {}
  return DEFAULT_LOCALE;
}

function setLocale(code) {
  current = pickLocale(code);
}

function t(key, values) {
  let text = LOCALES[current][key];
  if (text === undefined) text = LOCALES[DEFAULT_LOCALE][key];
  if (text === undefined) return key;
  if (values) {
    Object.keys(values).forEach((name) => {
      text = text.split("{" + name + "}").join(String(values[name]));
    });
  }
  return text;
}

module.exports = { LOCALES, detectLocale, setLocale, t };
