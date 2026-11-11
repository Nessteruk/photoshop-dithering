const { entrypoints } = require("uxp");
const { action } = require("photoshop");
const panel = require("./src/ui/panel");

const EVENTS = [{ event: "select" }, { event: "open" }, { event: "close" }];

entrypoints.setup({
  panels: {
    dithering: {
      create() {
        panel.start();
      },
      show() {
        panel.applyTheme();
        panel.startThemeWatch();
        panel.refreshSource();
        action.addNotificationListener(EVENTS, panel.refreshSource);
      },
      hide() {
        panel.stopThemeWatch();
        action.removeNotificationListener(EVENTS, panel.refreshSource);
      },
      destroy() {}
    }
  }
});
