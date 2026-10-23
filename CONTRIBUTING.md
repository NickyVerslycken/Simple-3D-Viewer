# Contributing

Thanks for wanting to help! Simple 3D Viewer is meant to stay small and simple, so changes that keep it that way are the easiest to accept.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/NickyVerslycken/Simple-3D-Viewer/issues/new/choose) first. For anything bigger than a small fix, please discuss it there before writing code.
- **Be kind:** everyone taking part must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Security problems:** do not open a public issue, see [SECURITY.md](SECURITY.md).

## License of your contribution

The project is licensed under the [PolyForm Shield License 1.0.0](LICENSE). By submitting a pull request you confirm that you wrote the
change (or have the right to submit it) and that it may be distributed under that license.

## Development setup

Requires Node.js 20 or newer.

```bash
npm install
node node_modules/electron/install.js   # only needed with npm 11+, which blocks install scripts
npm start                               # build the renderer and run the app
npm run smoke                           # generate samples, load each format, write screenshots to test/out/
```

Project layout:

| Path | What lives there |
| --- | --- |
| `src/main/` | Electron main process: window, menus, file dialogs, "open with" handling |
| `src/renderer/viewer.js` | the three.js scene: camera, lights, materials, grid, zoom |
| `src/renderer/loaders.js` | one parser per file format |
| `src/renderer/app.js`, `index.html`, `style.css` | the user interface |
| `test/` | sample-model generator and the render smoke test |
| `scripts/` | build, icon, checksum and documentation-media scripts |

### Adding a file format

1. Add a loader in `src/renderer/loaders.js` (three.js ships many in `three/examples/jsm/loaders`) and return `{ root, ext, hasMaterials }`.
2. Add the extension to `EXTENSIONS` there and to `MODEL_EXTS` in `src/main/main.js`.
3. Add it to `fileAssociations` in `package.json` and to the README format table.
4. Add a sample to `test/make-samples.mjs` and a case to `test/smoke.cjs`.

## Pull requests

- Keep each pull request focused on one thing.
- Match the surrounding code style (see `.editorconfig`): 2 spaces, single quotes, semicolons.
- Run `npm run smoke` and look at the screenshots in `test/out/` if you touched rendering or loading.
- If the change is visible to users, add a line to [CHANGELOG.md](CHANGELOG.md) under *Unreleased*.
- If you add a dependency, say why it is needed and which license it uses. Dependencies must have a permissive license (MIT, BSD, Apache-2.0, ISC) so they stay compatible with the project license.
