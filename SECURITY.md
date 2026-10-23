# Security policy

## Supported versions

Only the [latest release](https://github.com/NickyVerslycken/Simple-3D-Viewer/releases/latest) receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub: [**Report a vulnerability**](https://github.com/NickyVerslycken/Simple-3D-Viewer/security/advisories/new).
Include the affected version, your operating system and, if possible, a file or steps that reproduce the problem.

You can expect an answer within about a week. Confirmed problems are fixed in a new release and credited in the release notes unless you prefer otherwise.

## Scope and design notes

- The app is a local viewer with **no network access** of its own and no telemetry.
- Model files are parsed with [three.js](https://threejs.org) loaders inside a sandboxed Electron renderer (`contextIsolation`, `sandbox`, a strict
  Content-Security-Policy, no Node.js access, no navigation or new windows). The main process only reads files with known 3D extensions, plus
  companion files (`.mtl`, `.bin`, images) from the opened model's own folder.
- Malformed or malicious model files that crash the app or use excessive memory are in scope. Please report them.
- Installers are currently **unsigned**. Always check the SHA-256 checksum published with each release.
