/**
 * 进度判定测试：node tests/progress.test.js
 */

var assert = require('assert')
var P = require('../utils/progress.js')

var pass = 0
function ok(name, fn) { fn(); pass++; console.log('  ok   ' + name) }

function key(text) { return P.judge(text).key }

console.log('\n[1] 认得出进度')

ok('没写 -> none', function () {
  assert.strictEqual(key(''), 'none')
  assert.strictEqual(key('   '), 'none')
  assert.strictEqual(key(null), 'none')
})

ok('「做到一半」-> 进行中', function () {
  assert.strictEqual(key('做到一半，素材还没找齐'), 'half')
  assert.strictEqual(P.judge('写到一半').label, '进行中')
})

ok('「快好了」-> 快好了', function () {
  assert.strictEqual(key('快好了，只差最后一段'), 'almost')
})

ok('「卡在等数据」-> 卡住了', function () {
  assert.strictEqual(key('卡在等数据，对方没回'), 'blocked')
})

ok('「刚开始」-> 刚起步', function () {
  assert.strictEqual(key('刚开始，看了下资料'), 'started')
})

ok('「还没动」-> 还没动', function () {
  assert.strictEqual(key('还没动'), 'notStarted')
  assert.strictEqual(key('没开始'), 'notStarted')
})

ok('「做完了」-> 写完了', function () {
  assert.strictEqual(key('做完了'), 'finished')
})

ok('写了但没有关键词 -> 有进展（不硬判成没动）', function () {
  assert.strictEqual(key('在弄了'), 'doing')
  assert.strictEqual(P.judge('在弄了').ratio, 0.5)
})

console.log('\n[2] 优先级（关键）')

ok('「做了一半 + 卡在等数据」判成卡住', function () {
  assert.strictEqual(key('做了一半，卡在等数据'), 'blocked')
})

ok('「还没做完」不会被当成做完了', function () {
  assert.strictEqual(key('还没做完'), 'notStarted')
  assert.strictEqual(key('没写完'), 'notStarted')
})

ok('「快好了」不会被「还没找齐」带跑', function () {
  // 「快好了」在前面，先命中 almost
  assert.strictEqual(key('快好了，素材还没找齐'), 'almost')
})

console.log('\n[3] 折算与汇总')

var ITEMS = [
  { title: '写周报', done: true },
  { title: '找素材', done: false, progress: '做到一半' },
  { title: '发邮件', done: false, progress: '快好了' },
  { title: '打卡', done: false, progress: '' }
]

ok('整体推进 = 打勾 + 进度折算的平均', function () {
  // 1 + 0.5 + 0.85 + 0 = 2.35 / 4 = 58.75 -> 59
  assert.strictEqual(P.ratioOf(ITEMS), 59)
})

ok('空清单是 0', function () {
  assert.strictEqual(P.ratioOf([]), 0)
  assert.strictEqual(P.ratioOf(null), 0)
})

ok('汇总只统计写了进度的未完成项', function () {
  var t = P.tally(ITEMS)
  assert.strictEqual(t.length, 2)
  var labels = t.map(function (x) { return x.label }).sort()
  assert.deepStrictEqual(labels, ['进行中', '快好了'].sort())
})

ok('全打勾就是 100', function () {
  assert.strictEqual(P.ratioOf([
    { title: 'A', done: true },
    { title: 'B', done: true }
  ]), 100)
})

ok('全没写就是 0', function () {
  assert.strictEqual(P.ratioOf([
    { title: 'A', done: false, progress: '' },
    { title: 'B', done: false }
  ]), 0)
})

console.log('\n全部通过  (pass ' + pass + ', fail 0)\n')
