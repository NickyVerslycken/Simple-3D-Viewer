// Builds the Microsoft Store package (release/Simple-3D-Viewer-Store.appx). Run with `npm run dist:store`.
//
// 1. refuses to run while the Store identity in package.json is still a placeholder
// 2. finds MakeAppx.exe in the installed Windows SDK (the copies electron-builder downloads do not start on some Windows 11 PCs)
// 3. builds the renderer and the .appx package
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.platform !== 'win32') {
  console.error('The Microsoft Store package can only be built on Windows.');
  process.exit(1);
}

if (!process.env.STORE_SKIP_IDENTITY_CHECK) run('node', ['scripts/check-store-config.mjs']);

const sdkBin = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
const versions = existsSync(sdkBin) ? readdirSync(sdkBin).filter((v) => /^10\./.test(v)).sort().reverse() : [];
const version = versions.find((v) => existsSync(join(sdkBin, v, 'x64', 'makeappx.exe')));
if (!version) {
  console.error('\nThe Windows SDK (MakeAppx.exe) was not found. Install it once with:');
  console.error('  winget install Microsoft.WindowsSDK.10.0.26100\n');
  process.exit(1);
}
const kit = join(sdkBin, version, 'x64');
console.log(`Using MakeAppx from Windows SDK ${version}`);

run('node', ['scripts/build.mjs']);
run('node', ['node_modules/electron-builder/cli.js', '--win', 'appx', '--publish', 'never'], {
  ELECTRON_BUILDER_WINDOWS_KITS_PATH: kit,
});
console.log('\nStore package: release/Simple-3D-Viewer-Store.appx  (upload this file in Partner Center)');
