import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const manifest = JSON.parse(
  readFileSync(new URL('../public/vooya/manifest.json', import.meta.url))
);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
assert.equal(
  pkg.devDependencies['@vooya/provider-rust'],
  manifest.provider,
  'Rebuild WASM after changing the provider'
);
for (const [path, expected] of Object.entries(manifest.sha256)) {
  const actual = createHash('sha256')
    .update(readFileSync(new URL(`../${path}`, import.meta.url)))
    .digest('hex');
  assert.equal(
    actual,
    expected,
    `${path} changed. Run pnpm --filter docs build:wasm and commit the generated artifacts.`
  );
}
console.log('Verified committed Vooya WASM artifacts and source hashes');
