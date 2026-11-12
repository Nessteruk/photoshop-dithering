# Dithering

A Photoshop panel that applies a dithering effect directly to a layer, with no need to flatten the image, switch to grayscale, or resize the document.

[Version française](README.fr.md)

## Status

Version 1.0.1. *Add a Dithering layer* creates a layer that dithers everything below it (or only the layer it is clipped to). The settings update it live, and it can update itself when the layers below change. Dithering layers can be duplicated, copied into another document, converted to normal layers, and keep their settings in the document. It has not been tested on many documents yet, so please report any problem as an issue.

Known limits: 32-bit documents are not supported, and a Dithering layer keeps its settings in the document, so it stays editable after closing the file.

## Goals

- Apply the effect to any layer, including smart objects, without destroying the original.
- Classic algorithms: Floyd-Steinberg, Atkinson, Stucki, Sierra Lite, Bayer (2x2 to 16x16), blue noise and halftone screens (square, hexagon, radial, line, circle), with a size, contrast and brightness.
- From 2 to 16 levels, in black and white or keeping the colors channel by channel.
- Light on resources: one bundled file, no background work while the panel is idle.
- A dockable panel that follows Photoshop's theme, in English and French.
- Easy to extend: a new dithering algorithm is one file, a new setting is one line in a schema, and the panel styles every field from one stylesheet.

## Compatibility

Photoshop 26.0 and later (the interface uses Spectrum Web Components, which need a recent UXP). Developed and tested on Photoshop 28.

## Install

Download `Dithering-<version>.ccx` from the [latest release](https://github.com/Nessteruk/photoshop-dithering/releases/latest) and double-click it: Creative Cloud installs it in Photoshop 26 or later. Then open **Plugins > Dithering**. The plugin is distributed outside the Adobe Marketplace, so Photoshop may show an unverified-plugin notice.

### Windows on ARM (unofficial)

On Windows on ARM (Surface Pro with a Snapdragon chip), Creative Cloud cannot install a `.ccx`, so double-clicking it does nothing. The plugin itself is plain JavaScript and has nothing specific to the processor. As a workaround, close Photoshop, download `Dithering-<version>.ccx` and [`tools/install-manual.ps1`](tools/install-manual.ps1) into the same folder, and run in PowerShell:

```
powershell -ExecutionPolicy Bypass -File .\install-manual.ps1 -Package .\Dithering-<version>.ccx
```

It copies the plugin to `%APPDATA%\Adobe\UXP\Plugins\External` and registers it in `PluginsInfo\v1\PS.json`, which is what Creative Cloud does on x86 machines. Restart Photoshop, then **enable developer mode** in **Edit > Preferences > Plugins** ("Enable Developer Mode") and restart Photoshop again: without it, the **Plugins** menu is not shown on ARM, so the Dithering panel cannot be opened. Then open **Plugins > Dithering**. Use `-Uninstall` to remove it. This is not supported by Adobe.

## Install for development

1. Install **UXP Developer Tool** from the Creative Cloud app, and Node.js 22 or later.
2. In this folder, run `npm install` and then `npm run build`. The build writes `dist/main.js`, which the panel loads.
3. Start Photoshop, then UXP Developer Tool.
4. Click **Add Plugin** and select `manifest.json` from this folder, then **Load**.
5. In Photoshop, open **Plugins > Dithering**. The panel can be docked like Layers or Properties.

After a change in `src`, run `npm run build` (or `npm run watch`) and click **Reload** in UXP Developer Tool. A change in `styles.css` or `index.html` only needs **Reload**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Adding a setting or an algorithm only takes a few lines.

```
npm test
```

## License

[MIT](LICENSE). The bundled Spectrum Web Components and their dependencies keep their own licenses, listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
