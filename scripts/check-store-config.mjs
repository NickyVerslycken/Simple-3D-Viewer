// Stops `npm run dist:store` while the Microsoft Store identity values in package.json are still placeholders.
// A package built with wrong values is rejected by Partner Center, so fail early with a clear message.
import { readFileSync } from 'node:fs';

const appx = JSON.parse(readFileSync('package.json', 'utf8')).build?.appx ?? {};
const problems = [];

for (const key of ['identityName', 'publisher', 'publisherDisplayName']) {
  const value = appx[key];
  if (!value || /REPLACE/i.test(value)) problems.push(`build.appx.${key} is still a placeholder`);
}
if (appx.publisher && !/REPLACE/i.test(appx.publisher) && !/^CN=.+/.test(appx.publisher)) {
  problems.push('build.appx.publisher must look like "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" (copy it from Partner Center)');
}
if (appx.identityName && !/REPLACE/i.test(appx.identityName) && !/^[A-Za-z0-9.-]+$/.test(appx.identityName)) {
  problems.push('build.appx.identityName may only contain letters, digits, "." and "-"');
}

if (problems.length) {
  console.error('\nMicrosoft Store package not built:\n  - ' + problems.join('\n  - '));
  console.error('\nCopy the three values from Partner Center (Product management > Product identity) into package.json,');
  console.error('see docs/MICROSOFT-STORE.md, step 3.\n');
  process.exit(1);
}
console.log(`Store identity OK: ${appx.identityName} / ${appx.publisher} / ${appx.publisherDisplayName}`);
