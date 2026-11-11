# Contributing

Thanks for your interest. This is a small project, so the process is light.

## Before you start

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It explains how settings and algorithms are declared.
- Open an issue first for anything bigger than a small fix, to agree on the approach.

## Setup

You need Photoshop 26.0 or later, UXP Developer Tool and Node 22 or later (see the README). `npm install` then `npm run build` produces the bundle the panel loads; `npm test` runs the tests, and `npm run package` builds the `Dithering-<version>.ccx` file to install or publish.

```
npm test
```

## Guidelines

- **Few dependencies.** The only dependencies are the Spectrum Web Components wrappers (`@swc-uxp-wrappers/*`, versions pinned without `^`) and webpack to bundle them. Ask before adding another one.
- **Pure logic stays pure.** Code in `src/core` and `src/algorithms` must not call Photoshop, so it can be tested with Node.
- **Declare, don't hard-code.** New settings go in a schema, not in `index.html`. The panel is built from the schema by the components in `src/ui/components.js`.
- **Style once.** Every element comes from `src/ui/components.js` and is a Spectrum component in size S. `styles.css` only holds layout and Spectrum color tokens (`--spectrum-global-color-gray-*`); there is no hard-coded color, and scripts never set inline styles (a test checks it).
- **Translate every text.** Add each new string to all files in `src/locales/`. Tests fail on a missing translation.
- **Test what you add.** Add a test in `test/` for new logic.
- **Match Photoshop's look.** The panel mirrors Photoshop's own panels in size, color and spacing. See `docs/DECISIONS.md` (in French) before changing styles: several approaches were tried and ruled out because of UXP limitations.
- **Keep comments rare.** Explain decisions in `docs/DECISIONS.md`, not in code.

## Pull requests

- Keep each pull request focused on one change.
- Run `npm test` and check the panel in Photoshop before opening it.
- Describe what changed and how you checked it.

## License

By contributing, you agree that your contribution is released under the MIT license.
