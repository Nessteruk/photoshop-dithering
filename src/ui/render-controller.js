const effect = require("../photoshop/effect");
const { t } = require("../i18n");
const { ERROR_CODES } = require("../core/errors");
const registry = require("../registry");

const LIVE_DELAY = 150;
const BUSY_DELAY = 800;
const BUSY_RETRIES = 5;

function isHostBusy(error) {
  return Boolean(error && /modal state/i.test(String(error.message)));
}

function createRenderController(host) {
  let source = { key: "no-document" };
  let linkedKey = null;
  let busy = false;
  let queued = null;
  let timer = null;
  const pendingAuto = [];

  function currentLink() {
    return source.key === "linked" ? source.link : null;
  }

  function report(error) {
    console.error(error);
    const code = error && error.code;
    host.notify(ERROR_CODES.indexOf(code) !== -1 ? t("error." + code) : t("error.failed"));
    host.refreshSource();
  }

  async function run(task) {
    if (busy) {
      queued = task;
      return;
    }
    busy = true;
    host.notify(t("message.rendering"));
    try {
      await task();
    } catch (error) {
      report(error);
    }
    busy = false;
    if (queued) {
      const next = queued;
      queued = null;
      run(next);
    } else if (pendingAuto.length) {
      const next = pendingAuto.shift();
      refreshDocument(next.documentId, next.newLayers);
    }
  }

  function refreshDocument(documentId, newLayers, attempt) {
    if (busy) {
      const waiting = pendingAuto.find((entry) => entry.documentId === documentId);
      if (waiting) waiting.newLayers = Boolean(waiting.newLayers || newLayers);
      else pendingAuto.push({ documentId, newLayers: Boolean(newLayers) });
      return;
    }
    run(async () => {
      let result = { rendered: 0, adopted: false };
      try {
        result = await effect.refreshDocument(documentId, newLayers);
      } catch (error) {
        const tries = attempt || 0;
        if (!isHostBusy(error) || tries >= BUSY_RETRIES) throw error;
        setTimeout(() => refreshDocument(documentId, newLayers, tries + 1), BUSY_DELAY);
        host.refreshSource();
        return;
      }
      host.settleHistory(documentId, result.rendered > 0);
      if (result.rendered && !result.adopted) host.notify(t("message.rendered"));
      else host.refreshSource();
    });
  }

  function restore(documentId, stateId) {
    if (busy) return;
    run(async () => {
      if (await effect.restoreLinks(documentId, stateId)) linkedKey = null;
      host.settleHistory(documentId);
      host.refreshSource();
    });
  }

  function apply() {
    run(async () => {
      const added = await effect.addLayer(host.getSettings());
      host.settleHistory(added.documentId);
      host.refreshSource();
      host.notify(t("message.rendered"));
    });
  }

  function update() {
    run(async () => {
      const link = currentLink();
      if (!link) return;
      const name = source.name;
      await effect.updateLayer(link, host.getSettings());
      registry.remember(name, link.settings);
      host.settleHistory(link.documentId);
      host.notify(t("message.rendered"));
    });
  }

  function convert() {
    run(async () => {
      const link = currentLink();
      if (!link) return;
      await effect.convertLayer(link);
      host.settleHistory(link.documentId);
      host.refreshSource();
      host.notify(t("message.converted"));
    });
  }

  function settingsChanged() {
    if (!host.isLive() || !currentLink()) return;
    clearTimeout(timer);
    timer = setTimeout(update, LIVE_DELAY);
  }

  function setSource(next) {
    source = next;
    if (next.key !== "linked") {
      linkedKey = null;
      return;
    }
    registry.remember(next.name, next.link.settings);
    const key = next.link.documentId + ":" + next.link.resultId;
    if (key === linkedKey) return;
    linkedKey = key;
    host.applySettings(next.link.settings);
  }

  return { apply, update, convert, refreshDocument, restore, settingsChanged, setSource };
}

module.exports = { createRenderController };
