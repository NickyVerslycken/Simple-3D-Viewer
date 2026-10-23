// Writes release/SHA256SUMS-<platform>.txt for the installers in release/.
// Usage: node scripts/checksums.mjs <windows|macos|linux>
// The output uses the standard `sha256sum` format, so `sha256sum -c` / `shasum -a 256 -c` can verify it.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';

const PLATFORMS = {
  windows: /^Simple-3D-Viewer-Windows.*\.(exe|msi)$/,
  macos: /^Simple-3D-Viewer-macOS.*\.dmg$/,
  linux: /^Simple-3D-Viewer-Linux.*\.(AppImage|deb)$/,
};

const platform = process.argv[2];
if (!PLATFORMS[platform]) {
  console.error('Usage: node scripts/checksums.mjs <windows|macos|linux>');
  process.exit(1);
}

const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

const files = (await readdir('release')).filter((f) => PLATFORMS[platform].test(f)).sort();
if (!files.length) {
  console.error(`No ${platform} installers found in release/`);
  process.exit(1);
}
const lines = [];
for (const f of files) lines.push(`${await sha256(`release/${f}`)}  ${f}`);
const out = `release/SHA256SUMS-${platform}.txt`;
await writeFile(out, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
console.log(`wrote ${out}`);
