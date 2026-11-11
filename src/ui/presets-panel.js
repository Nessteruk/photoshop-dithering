const { storage } = require("uxp");
const { create, setEnabled, toggleClass } = require("./dom");
const components = require("./components");
const { t } = require("../i18n");
const storageApi = require("../storage");
const settingsApi = require("../core/settings");

const FILE_FORMAT = "dithering-presets";

function setupPresets(host) {
  let presets = storageApi.read("presets", {});
  let selected = "";

  const list = components.choice([], (name) => {
    selected = name;
    if (presets[name]) host.applySettings(presets[name]);
    refreshButtons();
  }, true);
  const nameField = components.textField({ placeholder: t("preset.namePlaceholder"), wide: true });
  const remove = components.button(t("preset.delete"), deleteSelected);

  function refreshButtons() {
    setEnabled(remove, Boolean(selected));
  }

  function fill(name) {
    selected = name;
    const names = Object.keys(presets);
    list.setOptions(names.map((key) => ({ value: key, label: key })), name);
    toggleClass(list.element, "hidden", names.length === 0);
    refreshButtons();
  }

  function persist() {
    storageApi.write("presets", presets);
  }

  function save() {
    const name = nameField.get().trim();
    if (!name) return host.notify(t("preset.nameRequired"));
    presets[name] = Object.assign({}, host.getSettings());
    persist();
    fill(name);
    nameField.set("");
    host.notify(t("preset.saved"));
  }

  function deleteSelected() {
    if (!selected) return;
    delete presets[selected];
    persist();
    fill("");
    host.notify(t("preset.deleted"));
  }

  async function exportPresets() {
    if (Object.keys(presets).length === 0) return host.notify(t("preset.nothingToExport"));
    try {
      const file = await storage.localFileSystem.getFileForSaving("dithering-presets.json", { types: ["json"] });
      if (!file) return;
      await file.write(JSON.stringify({ format: FILE_FORMAT, version: 1, presets }, null, 2));
      host.notify(t("preset.exported"));
    } catch (error) {
      host.notify(t("preset.exportFailed"));
    }
  }

  async function importPresets() {
    try {
      const file = await storage.localFileSystem.getFileForOpening({ types: ["json"] });
      if (!file) return;
      const content = JSON.parse(await file.read());
      if (!content || content.format !== FILE_FORMAT || typeof content.presets !== "object") {
        return host.notify(t("preset.importInvalid"));
      }
      const names = Object.keys(content.presets);
      names.forEach((name) => {
        presets[name] = settingsApi.sanitize(content.presets[name]);
      });
      persist();
      fill("");
      host.notify(t("preset.imported", { count: names.length }));
    } catch (error) {
      host.notify(t("preset.importFailed"));
    }
  }

  const body = create("div");
  body.appendChild(list.element);
  body.appendChild(components.row("", [nameField.element]));
  body.appendChild(components.row("", [components.button(t("preset.save"), save), remove]));
  body.appendChild(components.row("", [components.button(t("preset.import"), importPresets), components.button(t("preset.export"), exportPresets)]));
  fill("");

  return {
    body,
    markCustom() {
      if (selected) fill("");
    }
  };
}

module.exports = { setupPresets };
