const { create, byId } = require("./dom");

const WATCH_INTERVAL = 600;
const SPECTRUM_COLOR = { darkest: "dark", dark: "dark", light: "light", lightest: "lightest" };
let current = null;
let probe = null;
let timer = null;

function parseColor(text) {
  const raw = String(text || "").trim();
  let match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(raw);
  if (match) return match.slice(1, 4).map((hex) => parseInt(hex, 16));
  match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(raw);
  if (match) return match.slice(1, 4).map(Number);
  return null;
}

function brightness(rgb) {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}

function readBackground() {
  if (!probe) {
    probe = create("div", "theme-probe");
    document.body.appendChild(probe);
  }
  return parseColor(getComputedStyle(probe).backgroundColor);
}

function readText() {
  return parseColor(getComputedStyle(document.body).getPropertyValue("--uxp-host-text-color"));
}

function classify(background, text) {
  if (background) {
    const level = brightness(background);
    if (level < 66) return "darkest";
    if (level < 130) return "dark";
    if (level < 212) return "light";
    return "lightest";
  }
  if (text) return brightness(text) > 128 ? "dark" : "light";
  return "dark";
}

function detectTheme() {
  let background = null;
  let text = null;
  try {
    background = readBackground();
    text = readText();
  } catch (error) {
    console.error(error);
  }
  return classify(background, text);
}

function applyTheme() {
  const theme = detectTheme();
  if (theme === current) return;
  current = theme;
  const root = byId("theme");
  root.setAttribute("data-theme", theme);
  root.setAttribute("color", SPECTRUM_COLOR[theme]);
}

function startWatching() {
  if (timer === null) timer = setInterval(applyTheme, WATCH_INTERVAL);
}

function stopWatching() {
  clearInterval(timer);
  timer = null;
}

module.exports = { applyTheme, startWatching, stopWatching, SPECTRUM_COLOR };
