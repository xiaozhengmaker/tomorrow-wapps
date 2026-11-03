/**
 * 拆解引擎测试：node tests/breakdown.test.js
 */

var assert = require('assert')
var B = require('../utils/breakdown.js')
var D = require('../utils/date.js')

var pass = 0
function ok(name, fn) { fn(); pass++; console.log('  ok   ' + name) }

console.log('\n[1] 模板命中')

ok('写周报 -> 写点东西', function () {
  var c = B.build('写周报')
  assert.strictEqual(c.templateId, 'writing')
  assert.strictEqual(c.steps.length, 3)
})

ok('季度复盘会 -> 开会，而不是被「写」抢走', function () {
  var c = B.build('把季度复盘会开得有个结果')
  assert.strictEqual(c.templateId, 'meeting')
})

ok('面试 -> 面试模板', function () {
  assert.strictEqual(B.build('准备下周的面试').templateId, 'interview')
})

ok('搞懂这个概念 -> 学', function () {
  assert.strictEqual(B.build('搞懂什么是向量数据库').templateId, 'learning')
})

ok('打扫房间 -> 整理', function () {
  assert.strictEqual(B.build('把房间打扫一下').templateId, 'tidy')
})

ok('健身 -> 身体', function () {
  assert.strictEqual(B.build('去健身').templateId, 'body')
})

ok('没见过的话 -> 通用拆法', function () {
  var c = B.build('量子纠缠')
  assert.strictEqual(c.templateId, 'general')
  assert.strictEqual(c.steps.length, 3)
})

ok('空目标不产生卡片', function () {
  assert.strictEqual(B.build('   '), null)
})

console.log('\n[2] 最小可执行单元的形状')

ok('每一步都有文字和时长，时长在允许范围内', function () {
  var c = B.build('写周报')
  c.steps.forEach(function (s) {
    assert.ok(s.text.length > 0)
    assert.ok(B.STEP_MINUTES.indexOf(s.minutes) >= 0, '时长越界: ' + s.minutes)
    assert.ok(s.id)
  })
})

ok('每步都够短（<=30 分钟）', function () {
  var c = B.build('写周报')
  c.steps.forEach(function (s) { assert.ok(s.minutes <= 30) })
})

ok('最多 3 步（1-2-3 原则）', function () {
  var c = B.build('写周报')
  assert.ok(c.steps.length <= 3)
})

ok('总时长算得对', function () {
  var c = B.build('写周报') // 10 + 25 + 10
  assert.strictEqual(B.totalMinutes(c.steps), 45)
})

ok('卡片带分类标签', function () {
  assert.strictEqual(B.templateTag('writing'), '工作')
  assert.strictEqual(B.templateTag('tidy'), '生活')
  assert.strictEqual(B.templateTag('body'), '健康')
})

console.log('\n[3] 我的模板')

ok('存过同类模板后，下次优先命中它', function () {
  var mine = {
    id: 'u1',
    templateId: 'writing',
    name: '我的周报拆法',
    steps: [
      { text: '先把本周 5 件事列出来', minutes: 10 },
      { text: '每件事写一句结果', minutes: 15 }
    ]
  }
  var hit = B.findUserTemplate('写周报', [mine])
  assert.ok(hit)
  assert.strictEqual(hit.id, 'u1')

  var card = B.build('写周报', { userTemplate: hit })
  assert.strictEqual(card.fromUser, true)
  assert.strictEqual(card.steps.length, 2)
  assert.strictEqual(card.templateName, '我的周报拆法')
})

ok('没有同类模板时返回 null（走内置模板）', function () {
  assert.strictEqual(B.findUserTemplate('写周报', []), null)
})

console.log('\n[4] 排进清单')

var card = B.build('写周报')
var items = B.toPlanItems(card, { startMinutes: 9 * 60 })

ok('步骤一一变成事项', function () {
  assert.strictEqual(items.length, card.steps.length)
})

ok('时间依次排开，中间留 5 分钟', function () {
  // 09:00 起，第一步 10 分钟 -> 下一步 09:15
  assert.strictEqual(items[0].time, '09:00')
  assert.strictEqual(items[1].time, '09:15')
  // 第二步 25 分钟 -> 09:45
  assert.strictEqual(items[2].time, '09:45')
})

ok('时长跟着步骤走', function () {
  assert.deepStrictEqual(items.map(function (i) { return i.duration }), [10, 25, 10])
})

ok('标签沿用模板分类', function () {
  assert.strictEqual(items[0].tag, '工作')
})

ok('第一项标为重要（这是卡片的起点）', function () {
  assert.strictEqual(items[0].important, true)
  assert.strictEqual(items[1].important, false)
})

ok('生成的时间格式合法', function () {
  items.forEach(function (i) {
    assert.ok(/^\d{2}:\d{2}$/.test(i.time))
    assert.ok(D.hhmmToMinutes(i.time) >= 0)
  })
})

ok('时间不会跑到第二天', function () {
  var late = B.toPlanItems(card, { startMinutes: 23 * 60 })
  late.forEach(function (i) {
    var start = D.hhmmToMinutes(i.time)
    assert.ok(start + i.duration <= 23 * 60 + 59, i.time + ' 这一项会溢出到第二天')
  })
})

ok('跟已有事项撞车时会自动往后让', function () {
  var busy = [{ start: 9 * 60, end: 10 * 60 }] // 09:00-10:00 已经有会
  var shifted = B.toPlanItems(card, { startMinutes: 9 * 60, busy: busy })
  assert.strictEqual(shifted[0].time, '10:05', '应该让到 10:05 开始')
  assert.ok(D.hhmmToMinutes(shifted[0].time) >= 10 * 60)
})

ok('自己的步骤之间也不会互相盖住', function () {
  var items2 = B.toPlanItems(card, { startMinutes: 9 * 60, busy: [] })
  for (var i = 1; i < items2.length; i++) {
    var prevEnd = D.hhmmToMinutes(items2[i - 1].time) + items2[i - 1].duration
    assert.ok(D.hhmmToMinutes(items2[i].time) >= prevEnd)
  }
})

console.log('\n全部通过  (pass ' + pass + ', fail 0)\n')
