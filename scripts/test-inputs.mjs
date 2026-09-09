import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function readModule(path) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', source)(exports, require);
  return exports;
}
const { normalizeUsername, loginEmail, validPassword, sameOrigin } = readModule('../lib/auth-input.ts');
const { imageType } = readModule('../lib/avatar-input.ts');
assert.equal(normalizeUsername('  САША  '), 'саша');
assert.equal(normalizeUsername('Ｆｏｏ'), 'foo');
assert.equal(normalizeUsername('<script>'), null);
assert.equal(normalizeUsername('ab'), null);
assert.equal(loginEmail(normalizeUsername('PLAYER')), loginEmail(normalizeUsername('player')));
assert.equal(validPassword('short'), false);
assert.equal(validPassword('a'.repeat(129)), false);
assert.equal(validPassword('long-secret-pass'), true);
assert.equal(sameOrigin(new Request('https://turbo-league-s2.netlify.app/api/auth', { headers: { origin: 'https://evil.example' } })), false);
assert.equal(sameOrigin(new Request('https://turbo-league-s2.netlify.app/api/auth')), false);
assert.equal(sameOrigin(new Request('https://turbo-league-s2.netlify.app/api/auth', { headers: { origin: 'https://turbo-league-s2.netlify.app' } })), true);
assert.equal(imageType(Buffer.from('<svg onload="alert(1)"></svg>')), null);
assert.equal(imageType(Buffer.alloc(512 * 1024 + 1)), null);
assert.equal(imageType(readFileSync(new URL('../public/season3-winner.png', import.meta.url))), null); // winner poster exceeds avatar size
assert.equal(imageType(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])), 'image/png');
console.log('PASS: login normalization, password bounds, cross-origin protection, avatar type/size validation');
