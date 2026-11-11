function byId(id) {
  return document.getElementById(id);
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function toggleClass(element, name, on) {
  if (on) element.classList.add(name);
  else element.classList.remove(name);
}

function setEnabled(element, enabled) {
  toggleClass(element, "disabled", !enabled);
  if (enabled) element.removeAttribute("disabled");
  else element.setAttribute("disabled", "");
}

function onPress(element, handler) {
  element.addEventListener("click", () => {
    if (!element.classList.contains("disabled")) handler();
  });
}

module.exports = { byId, create, clear, toggleClass, setEnabled, onPress };
