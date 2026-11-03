/**
 * 校验 .ics 生成器：结构、时间、转义、换行符。
 *   node tests/ics.test.js
 */

var assert = require('assert')
var Ics = require('../utils/ics.js')
var D = require('../utils/date.js')

var pass = 0
function ok(name, fn) {
  fn()
  pass++
  console.log('  ok   ' + name)
}

var ITEMS = [
  { title: '跟客户开会', time: '09:00', duration: 60, tag: '工作', important: false },
  { title: '交电费', time: '10:30', duration: 30, tag: '生活', important: true },
  { title: '写周报', time: '14:30', duration: 45, tag: '工作', important: false }
]

var out = Ics.build(ITEMS, '2026-10-30', D, { alarmMinutes: 10 })

console.log('\n[1] 结构')

ok('一个 VCALENDAR', function () {
  assert.strictEqual((out.match(/BEGIN:VCALENDAR/g) || []).length, 1)
  assert.strictEqual((out.match(/END:VCALENDAR/g) || []).length, 1)
})

ok('三个 VEVENT，配对不缺', function () {
  assert.strictEqual((out.match(/BEGIN:VEVENT/g) || []).length, 3)
  assert.strictEqual((out.match(/END:VEVENT/g) || []).length, 3)
})

ok('每个事件都有告警', function () {
  assert.strictEqual((out.match(/BEGIN:VALARM/g) || []).length, 3)
  assert.strictEqual((out.match(/TRIGGER:-PT10M/g) || []).length, 3)
})

ok('VNEXT 必须有 VERSION 2.0 和 PRODID', function () {
  assert.ok(out.indexOf('VERSION:2.0') >= 0)
  assert.ok(/PRODID:/.test(out))
})

ok('整体以 END:VCALENDAR 收尾', function () {
  assert.ok(out.trimEnd().endsWith('END:VCALENDAR'))
})

console.log('\n[2] 时间')

ok('DTSTART 用浮动时间，不带 Z', function () {
  assert.ok(out.indexOf('DTSTART:20261030T090000') >= 0)
  assert.ok(!/DTSTART:\d{8}T\d{6}Z/.test(out))
})

ok('DTEND = 开始 + 时长', function () {
  assert.ok(out.indexOf('DTEND:20261030T100000') >= 0) // 09:00 + 60 分钟
  assert.ok(out.indexOf('DTEND:20261030T110000') >= 0) // 10:30 + 30 分钟
})

ok('45 分钟算得对', function () {
  // 14:30 + 45 分钟 = 15:15
  assert.ok(out.indexOf('DTEND:20261030T151500') >= 0)
})

ok('跨到 23:59 会被夹住而不是滚到第二天', function () {
  var late = Ics.build([{ title: '熬夜', time: '23:50', duration: 60, tag: '其他' }], '2026-10-30', D)
  assert.ok(late.indexOf('DTEND:20261030T235900') >= 0)
})

ok('UID 稳定可复现（同输入两次一致）', function () {
  var again = Ics.build(ITEMS, '2026-10-30', D)
  var first = out.match(/UID:[^\r\n]+/g)
  var second = again.match(/UID:[^\r\n]+/g)
  assert.deepStrictEqual(first, second)
})

console.log('\n[3] 转义与换行')

ok('逗号分号反斜杠都转义', function () {
  var t = Ics.esc('开会,顺便;聊\\预算')
  assert.strictEqual(t, '开会\\,顺便\\;聊\\\\预算')
})

ok('标题里的逗号不会破坏结构', function () {
  var one = Ics.build([{ title: '开会,A组;B组', time: '09:00', duration: 30, tag: '工作' }], '2026-10-30', D)
  assert.ok(one.indexOf('SUMMARY:开会\\,A组\\;B组') >= 0)
})

ok('用 CRLF 换行', function () {
  var nl = out.split('\r\n')
  assert.ok(nl.length > 10)
  assert.strictEqual(out.indexOf('\n') , out.indexOf('\r\n') + 1, '不能有裸 LF')
})

ok('中文原样保留（UTF-8）', function () {
  assert.ok(out.indexOf('SUMMARY:跟客户开会') >= 0)
})

console.log('\n[4] 边界')

ok('空清单也给一个合法日历', function () {
  var empty = Ics.build([], '2026-10-30', D)
  assert.ok(empty.startsWith('BEGIN:VCALENDAR'))
  assert.ok(empty.trimEnd().endsWith('END:VCALENDAR'))
  assert.strictEqual((empty.match(/BEGIN:VEVENT/g) || []).length, 0)
})

ok('alarmMinutes=0 时不写告警', function () {
  var noAlarm = Ics.build(ITEMS, '2026-10-30', D, { alarmMinutes: 0 })
  assert.strictEqual((noAlarm.match(/BEGIN:VALARM/g) || []).length, 0)
})

console.log('\n---- 生成样例（前 14 行）----')
console.log(out.split('\r\n').slice(0, 14).join('\n'))

console.log('\n[5] 每日提醒')

var daily = Ics.buildDaily('20:00', '写今日复盘', D)

ok('只有一件事，但每天重复', function () {
  assert.strictEqual((daily.match(/BEGIN:VEVENT/g) || []).length, 1)
  assert.ok(daily.indexOf('RRULE:FREQ=DAILY') >= 0)
})

ok('时间对得上，且是浮动时间', function () {
  assert.ok(/DTSTART:\d{8}T200000/.test(daily))
  assert.ok(!/DTSTART:\d{8}T\d{6}Z/.test(daily))
})

ok('到点就响（TRIGGER:PT0M）', function () {
  assert.ok(daily.indexOf('TRIGGER:PT0M') >= 0)
})

ok('改时间会跟着变', function () {
  var other = Ics.buildDaily('21:30', '写今日复盘', D)
  assert.ok(/DTSTART:\d{8}T213000/.test(other))
})

ok('标题里的逗号会被转义', function () {
  var odd = Ics.buildDaily('20:00', '复盘,顺便算账', D)
  assert.ok(odd.indexOf('SUMMARY:复盘\\,顺便算账') >= 0)
})

console.log('\n全部通过  (pass ' + pass + ', fail 0)\n')
