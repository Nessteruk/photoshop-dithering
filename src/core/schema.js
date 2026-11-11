const SECTIONS = ["source", "pattern", "colors"];

const COMMON_PARAMS = [
  { key: "autoUpdate", type: "checkbox", section: "source", default: true, order: 1 },
  { key: "includeHidden", type: "checkbox", section: "source", default: false, order: 2 },
  { key: "cellSize", type: "slider", section: "pattern", min: 1, max: 64, step: 1, unit: " px", default: 2, order: 10 },
  { key: "contrast", type: "slider", section: "pattern", min: 0, max: 100, step: 1, unit: "", default: 50, order: 20 },
  { key: "brightness", type: "slider", section: "pattern", min: 0, max: 100, step: 1, unit: "", default: 50, order: 30 },
  { key: "levels", type: "slider", section: "colors", min: 2, max: 16, step: 1, unit: "", default: 2, order: 2 },
  {
    key: "colorMode",
    type: "choice",
    section: "colors",
    default: "gray",
    order: 1,
    options: [{ value: "gray" }, { value: "color" }]
  }
];

module.exports = { SECTIONS, COMMON_PARAMS };
