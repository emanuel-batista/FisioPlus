import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('public tunnel uses ngrok instead of localtunnel', () => {
  assert.match(packageJson.scripts['tunnel:public'] || '', /ngrok/i);
  assert.doesNotMatch(packageJson.scripts['tunnel:public'] || '', /localtunnel|loca\.lt/i);
});
