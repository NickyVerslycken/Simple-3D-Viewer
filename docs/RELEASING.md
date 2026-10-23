# Releasing

Installers are published as **GitHub Release assets**, not committed to the repository: GitHub rejects files over 100 MB in a normal push
and every committed installer would stay in the repository history forever. Release assets can be up to 2 GB, have stable direct-download
URLs and show a SHA-256 digest.

The README links to the *latest* release with fixed file names:

```
https://github.com/NickyVerslycken/Simple-3D-Viewer/releases/latest/download/<file name>
```

| Platform | Files | Checksum file |
| --- | --- | --- |
| Windows | `Simple-3D-Viewer-Windows-Setup.exe`, `Simple-3D-Viewer-Windows.msi` | `SHA256SUMS-windows.txt` |
| macOS | `Simple-3D-Viewer-macOS.dmg` (universal: Apple silicon + Intel) | `SHA256SUMS-macos.txt` |
| Linux | `Simple-3D-Viewer-Linux.AppImage`, `Simple-3D-Viewer-Linux.deb` | `SHA256SUMS-linux.txt` |

Keep these names. The links in the README depend on them.

## Publishing a new version

1. Update `version` in `package.json` and add the changes to `CHANGELOG.md`. Commit and push.
2. Build the installers on each platform (below), or let GitHub build them (see *Automated builds*).
3. Create the release (once) and attach the files.

```bash
gh release create v1.0.1 --title "v1.0.1" --notes "See CHANGELOG.md" \
  release/Simple-3D-Viewer-Windows-Setup.exe release/Simple-3D-Viewer-Windows.msi release/SHA256SUMS-windows.txt
```

## Build on Windows

```bash
npm ci
node node_modules/electron/install.js
npm run dist:win          # also writes release/SHA256SUMS-windows.txt
```

## Build on a Mac

```bash
git clone https://github.com/NickyVerslycken/Simple-3D-Viewer.git
cd Simple-3D-Viewer
npm ci
node node_modules/electron/install.js
npm run dist:mac          # universal .dmg + release/SHA256SUMS-macos.txt
```

Add the files to the existing release (replace `v1.0.0` with the release tag):

```bash
gh release upload v1.0.0 release/Simple-3D-Viewer-macOS.dmg release/SHA256SUMS-macos.txt --clobber
```

Or use the web page: *Releases → the release → Edit → drag the two files in → Update release*.

The `README` download link for macOS starts working as soon as `Simple-3D-Viewer-macOS.dmg` is attached to the latest release.

> The disk image is not signed or notarized. Users see a Gatekeeper warning and must right-click → *Open* the first time (this is described in the README).
> To sign and notarize you need an Apple Developer ID. See the [electron-builder docs](https://www.electron.build/code-signing-mac).

## Build on Linux

```bash
npm ci
node node_modules/electron/install.js
npm run dist:linux        # AppImage + .deb + release/SHA256SUMS-linux.txt
```

## Automated builds

The **Release** workflow (*Actions → Release → Run workflow*) builds the Windows, macOS and Linux installers on GitHub's servers and attaches
them, with checksum files, to the release you name. Use it instead of the manual steps if you prefer. Files with the same name are replaced,
so do not mix manually built and automatically built files of the same platform: the checksum file has to match the installer next to it.

## Checking a build

```bash
npm run smoke      # renders every sample format; look at test/out/*.png
npm run checksums -- windows   # (re)creates release/SHA256SUMS-windows.txt
```

## Regenerating the README media

`npm run media` re-captures the screenshots and the demo animation (`docs/`) from the real app, so they can be refreshed after UI changes.
