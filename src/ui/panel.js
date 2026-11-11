require("./swc");
const { ALGORITHMS } = require("../algorithms/index");
const settingsApi = require("../core/settings");
const { SECTIONS } = require("../core/schema");
const storageApi = require("../storage");
const i18n = require("../i18n");
const { readActiveSource } = require("../photoshop/source");
const autoUpdate = require("../photoshop/auto-update");
const { byId, create, toggleClass, setEnabled } = require("./dom");
const components = require("./components");
const { buildControl } = require("./controls");
const { setupPresets } = require("./presets-panel");
const { createRenderController } = require("./render-controller");
const { confirmDialog } = require("./confirm");
const theme = require("./theme");

const t = i18n.t;

const SOURCE_TEXT = {
  "no-document": { state: "state.noDocument", message: "message.openDocument" },
  "no-layer": { state: "state.noLayer", message: "message.selectLayer" },
  "ready": { state: "state.ready", message: "message.ready" },
  "linked": { state: "state.linked", message: "message.linked" }
};

const state = {
  settings: settingsApi.sanitize(storageApi.read("settings", {})),
  sourceKey: "no-document"
};

const ui = {};
const controls = [];
let presets = null;
let controller = null;
let saveTimer = null;
let sourceRequest = 0;

function notify(text) {
  ui.status.textContent = text;
}

function refresh() {
  controls.forEach(({ param, control }) => {
    control.update(state.settings);
    toggleClass(control.element, "hidden", !settingsApi.isVisible(param, state.settings));
  });
  if (ui.algorithm) ui.algorithm.set(state.settings.algorithm);
}

function settingsChanged(silent) {
  refresh();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storageApi.write("settings", state.settings), 400);
  if (!silent) controller.settingsChanged();
}

function set(key, value) {
  state.settings[key] = value;
  presets.markCustom();
  settingsChanged(false);
}

function applySettings(settings, silent) {
  state.settings = settingsApi.sanitize(settings);
  settingsChanged(silent);
}

const api = { get: (key) => state.settings[key], set };

function buildParams(sectionId, container) {
  settingsApi.paramsForSection(sectionId).forEach((param) => {
    const control = buildControl(param, api);
    container.appendChild(control.element);
    controls.push({ param, control });
  });
}

function buildSource() {
  const body = create("div");
  ui.state = create("span", "secondary", "—");
  body.appendChild(components.line(t("source.state"), ui.state));
  ui.apply = components.button(t("source.apply"), () => controller.apply());
  ui.update = components.button(t("source.update"), () => controller.update());
  ui.convert = components.button(t("source.convert"), convert);
  body.appendChild(components.row("unlinked-only", [ui.apply]));
  body.appendChild(components.row("linked-only", [ui.update]));
  body.appendChild(components.row("linked-only", [ui.convert]));
  const params = create("div", "linked-only");
  buildParams("source", params);
  body.appendChild(params);
  ui.live = components.checkbox(t("source.livePreview"));
  ui.live.element.classList.add("linked-only");
  ui.live.set(true);
  body.appendChild(ui.live.element);
  return components.section(t("section.source"), body);
}

function buildSection(sectionId) {
  const body = create("div");
  if (sectionId === "pattern") {
    ui.algorithm = components.select(
      ALGORITHMS.map((algorithm) => ({ value: algorithm.id, label: t("algorithm." + algorithm.id) })),
      (value) => set("algorithm", value)
    );
    body.appendChild(components.row("tight", [ui.algorithm.element]));
  }
  buildParams(sectionId, body);
  return components.section(t("section." + sectionId), body, "linked-only");
}

async function convert() {
  const confirmed = await confirmDialog({
    title: t("confirm.convertTitle"),
    message: t("confirm.convertMessage"),
    confirmLabel: t("confirm.convert"),
    cancelLabel: t("confirm.cancel")
  });
  if (confirmed) controller.convert();
}

function updateButtons() {
  const linked = state.sourceKey === "linked";
  setEnabled(ui.apply, state.sourceKey === "ready");
  setEnabled(ui.update, linked);
  setEnabled(ui.convert, linked);
  ui.linkedOnly.forEach((element) => toggleClass(element, "hidden", !linked));
  ui.unlinkedOnly.forEach((element) => toggleClass(element, "hidden", linked));
}

function setSource(source) {
  const text = SOURCE_TEXT[source.key];
  state.sourceKey = source.key;
  ui.state.textContent = t(text.state);
  notify(t(text.message));
  controller.setSource(source);
  updateButtons();
}

async function refreshSource() {
  const request = ++sourceRequest;
  let source;
  try {
    source = await readActiveSource();
  } catch (error) {
    console.error(error);
    source = { key: "no-layer" };
  }
  if (request === sourceRequest) setSource(source);
  autoUpdate.flush();
}

function showVersion() {
  try {
    ui.version.textContent = "v" + require("uxp").versions.plugin;
  } catch (error) {
    ui.version.textContent = "";
  }
}

function start() {
  i18n.setLocale(i18n.detectLocale());
  ui.status = byId("status");
  ui.version = byId("version");
  controller = createRenderController({
    getSettings: () => state.settings,
    isLive: () => ui.live.get(),
    applySettings: (settings) => applySettings(settings, true),
    notify,
    refreshSource,
    settleHistory: autoUpdate.settle
  });
  autoUpdate
    .start((documentId, newLayers) => controller.refreshDocument(documentId, newLayers), (documentId, stateId) => controller.restore(documentId, stateId))
    .catch((error) => console.error(error));

  presets = setupPresets({
    getSettings: () => state.settings,
    applySettings: (settings) => applySettings(settings, false),
    notify
  });
  const content = byId("content");
  const sections = [buildSource()]
    .concat(SECTIONS.filter((id) => id !== "source").map(buildSection))
    .concat(components.section(t("section.presets"), presets.body, "linked-only"));
  sections.forEach((section, index) => {
    if (index > 0) {
      const rule = components.divider();
      rule.classList.add("linked-only");
      content.appendChild(rule);
    }
    content.appendChild(section);
  });
  ui.linkedOnly = Array.from(document.querySelectorAll(".linked-only"));
  ui.unlinkedOnly = Array.from(document.querySelectorAll(".unlinked-only"));

  refresh();
  theme.applyTheme();
  showVersion();
}

module.exports = { start, refreshSource, applyTheme: theme.applyTheme, startThemeWatch: theme.startWatching, stopThemeWatch: theme.stopWatching };
