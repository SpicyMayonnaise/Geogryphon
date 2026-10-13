// Usage: node tools/test-answer-states.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const fn = src.match(/function markAnswers\([\s\S]*?\n}\n/);
assert.ok(fn, 'markAnswers() not found in game.js');
const mk = code => ({ dataset: { code }, classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); } } });
const tiles = [mk('KW'), mk('SD'), mk('MC')];
const ctx = { $: () => ({ querySelectorAll: () => tiles }) };
vm.createContext(ctx);
vm.runInContext(fn[0] + ';this.markAnswers=markAnswers;', ctx);
ctx.markAnswers('SD', 'KW');
assert.deepStrictEqual([...tiles[0].classList.s], ['is-correct']);
assert.deepStrictEqual([...tiles[1].classList.s], ['is-wrong']);
assert.deepStrictEqual([...tiles[2].classList.s], []);
ctx.markAnswers(null, null);
assert.ok(tiles.every(t => t.classList.s.size === 0), 'marks clear');
console.log('answer states OK');
