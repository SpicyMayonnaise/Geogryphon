// Usage: node tools/test-tokens-js.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const vars = { '--accent': ' #ffd23f', '--bad': '#ff4d6d', '--font-body': "'Nunito',system-ui" };
const ctx = {
  document: { documentElement: {}, getElementById: () => null },
  getComputedStyle: () => ({ getPropertyValue: n => vars[n] || '' }),
  localStorage: { getItem() {}, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'util.js'), 'utf8') + '\n;this.token=token;this.tokenHex=tokenHex;', ctx);

assert.strictEqual(ctx.token('accent'), '#ffd23f');
assert.strictEqual(ctx.tokenHex('accent'), 0xffd23f);
assert.strictEqual(ctx.tokenHex('bad'), 0xff4d6d);
assert.throws(() => ctx.tokenHex('missing'), /Unknown colour token --missing/);
assert.throws(() => ctx.tokenHex('font-body'), /Unknown colour token --font-body/);
console.log('token helpers OK');
