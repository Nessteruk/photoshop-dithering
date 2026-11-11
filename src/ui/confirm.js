const { create } = require("./dom");

const WIDTH = 380;
const TEXT_WIDTH = WIDTH - 48;
const CHAR_WIDTH = 6.3;
const LINE_HEIGHT = 18;
const FIXED_HEIGHT = 68;

function dialogHeight(message) {
  const lines = Math.max(1, Math.ceil((String(message).length * CHAR_WIDTH) / TEXT_WIDTH));
  return FIXED_HEIGHT + lines * LINE_HEIGHT;
}

function confirmDialog(options) {
  return new Promise((resolve) => {
    const dialog = create("dialog", "dialog");
    const body = create("form", "dialog-body");
    const actions = create("div", "dialog-actions");
    const cancel = create("button", "", options.cancelLabel);
    const ok = create("button", "", options.confirmLabel);
    ok.setAttribute("variant", "cta");
    actions.appendChild(cancel);
    actions.appendChild(ok);
    body.appendChild(create("p", "dialog-message", options.message));
    body.appendChild(actions);
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    const finish = (answer) => {
      resolve(answer);
      try {
        dialog.close(answer ? "ok" : "cancel");
      } catch (error) {
        console.error(error);
      }
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    };
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));

    if (typeof dialog.uxpShowModal !== "function") {
      finish(true);
      return;
    }
    dialog.uxpShowModal({ title: options.title, resize: "none", size: { width: WIDTH, height: dialogHeight(options.message) } })
      .then((value) => {
        if (value !== "ok" && value !== "cancel") finish(false);
      })
      .catch(() => finish(false));
  });
}

module.exports = { confirmDialog, dialogHeight };
