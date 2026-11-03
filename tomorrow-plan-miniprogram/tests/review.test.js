/**
 * 复盘评估测试：node tests/review.test.js
 * 重点是「中性口径」——不能夸、不能骂、不能给建议。
 */

var assert = require('assert')
var R = require('../utils/review.js')

var pass = 0
function ok(name, fn) { fn(); pass++; console.log('  ok   ' + name) }

var PLAN = {
  date: '2026-10-29',
  items: [
    { title: '写周报', time: '09:00', tag: '工作', done: true },
    { title: '交电费', time: '10:00', tag: '生活', done: true },
    { title: '取快递', time: '11:00', tag: '生活', done: true },
    { title: '给客户回电话', time: '14:00', tag: '工作', done: false },
    { title: '健身', time: '20:00', tag: '健康', done: false },
    { title: '整理桌面', time: '21:00', tag: '生活', done: false }
  ]
}

var NOTE = '上午开会超时，客户电话来不及打。晚上太累，健身没去。整理桌面推到明天。'

var res = R.analyze({ plan: PLAN, note: NOTE, score: 3, date: '2026-10-29' })

console.log('\n[1] 数字与事实')

ok('完成率算对', function () {
  assert.strictEqual(res.total, 6)
  assert.strictEqual(res.doneCount, 3)
  assert.strictEqual(res.undoneCount, 3)
  assert.strictEqual(res.rate, 50)
})

ok('第一句就是账', function () {
  assert.strictEqual(res.lines[0], '计划 6 项，完成 3 项（50%）。')
})

ok('列出完成的和没动的', function () {
  var all = res.lines.join('\n')
  assert.ok(all.indexOf('完成的是：写周报、交电费、取快递') >= 0)
  assert.ok(all.indexOf('没动的是：给客户回电话、健身、整理桌面') >= 0)
})

ok('完成的内容按分类拆开说', function () {
  var all = res.lines.join('\n')
  assert.ok(all.indexOf('工作 1 项') >= 0)
  assert.ok(all.indexOf('生活 2 项') >= 0)
})

ok('超过一半没动时点出来', function () {
  var half = R.analyze({
    plan: { items: [
      { title: 'A事', tag: '工作', done: true },
      { title: 'B事', tag: '工作', done: false },
      { title: 'C事', tag: '工作', done: false }
    ] },
    note: ''
  })
  assert.ok(half.lines.join('\n').indexOf('超过一半的计划还没打勾') >= 0)
})

console.log('\n[2] 从文字里抽原因')

ok('认出「开会」和「来不及」', function () {
  var words = res.reasons.map(function (r) { return r.word })
  assert.ok(words.indexOf('开会') >= 0)
  assert.ok(words.indexOf('来不及') >= 0)
  assert.ok(words.indexOf('太累') >= 0)
})

ok('原因写进了评估里', function () {
  var all = res.lines.join('\n')
  assert.ok(all.indexOf('你写的话里出现') >= 0)
  assert.ok(all.indexOf('开会 ×1') >= 0)
})

ok('不重复罗列同一个词', function () {
  var dup = R.analyze({
    plan: { items: [] },
    note: '开会开会开会，一直开会'
  })
  var hits = dup.reasons.filter(function (r) { return r.word === '开会' })
  assert.strictEqual(hits.length, 1)
  assert.strictEqual(hits[0].count, 4)
})

ok('认得出没完成的事项被提到', function () {
  var all = res.lines.join('\n')
  assert.ok(all.indexOf('没完成的事项里，你提到了') >= 0)
  assert.ok(res.mentions.indexOf('健身') >= 0)
})

console.log('\n[3] 进度判定')

ok('写了进度的项会被列出来', function () {
  var r = R.analyze({
    plan: { items: [
      { title: '写周报', time: '09:00', duration: 45, tag: '工作', done: false, progress: '做到一半' },
      { title: '找素材', time: '10:30', duration: 30, tag: '工作', done: false, progress: '卡在等数据' },
      { title: '打卡', time: '11:00', duration: 5, tag: '生活', done: false, progress: '' }
    ] },
    note: ''
  })
  var all = r.lines.join('\n')
  assert.strictEqual(r.judgedCount, 2)
  assert.strictEqual(r.silentCount, 1)
  assert.ok(all.indexOf('写了进度的 2 项：写周报「进行中」、找素材「卡住了」。') >= 0)
  assert.ok(all.indexOf('既没打勾也没写进度的：打卡。') >= 0)
})

ok('按进度折算整体推进', function () {
  // 1 + 0.5 + 0.85 + 0 = 2.35 / 4 = 58.75 -> 59
  var r = R.analyze({
    plan: { items: [
      { title: 'A', time: '09:00', tag: '工作', done: true },
      { title: 'B', time: '10:00', tag: '工作', done: false, progress: '做到一半' },
      { title: 'C', time: '11:00', tag: '工作', done: false, progress: '快好了' },
      { title: 'D', time: '12:00', tag: '工作', done: false }
    ] },
    note: ''
  })
  assert.strictEqual(r.progressRatio, 59)
  assert.ok(r.lines.join('\n').indexOf('按进度折算，今天整体推进约 59%。') >= 0)
})

ok('一项进度都没写就不提折算', function () {
  var r = R.analyze({ plan: PLAN, note: '' })
  assert.strictEqual(r.judgedCount, 0)
  assert.ok(r.lines.join('\n').indexOf('按进度折算') < 0)
})

console.log('\n[4] 中性口径（关键）')

ok('没有夸奖词', function () {
  var all = res.lines.join('')
  var praise = ['厉害', '很棒', '不错', '优秀', '精彩', '完美']
  praise.forEach(function (w) {
    assert.ok(all.indexOf(w) < 0, '出现了夸奖词: ' + w)
  })
})

ok('没有批评词', function () {
  var all = res.lines.join('')
  var blame = ['可惜', '浪费', '失败', '拖延症', '偷懒', '不自律']
  blame.forEach(function (w) {
    assert.ok(all.indexOf(w) < 0, '出现了批评词: ' + w)
  })
})

ok('不给建议、不讲道理', function () {
  var all = res.lines.join('')
  var advice = ['建议', '应该', '下次', '不如', '试试', '加油', '记住']
  advice.forEach(function (w) {
    assert.ok(all.indexOf(w) < 0, '出现了建议类措辞: ' + w)
  })
})

ok('每句话都是陈述句，以句号收尾', function () {
  res.lines.forEach(function (l) {
    assert.ok(l.charAt(l.length - 1) === '。', '这句不是陈述句: ' + l)
  })
})

console.log('\n[5] 边界')

ok('没写文字时只报账', function () {
  var r = R.analyze({ plan: PLAN, note: '' })
  var all = r.lines.join('\n')
  assert.ok(all.indexOf('今天没有写复盘文字') >= 0)
  assert.ok(all.indexOf('你写的话里出现') < 0)
})

ok('清单空着也不崩', function () {
  var r = R.analyze({ plan: null, note: '今天啥也没干' })
  assert.ok(r.lines[0].indexOf('今天没有清单') >= 0)
  assert.strictEqual(r.rate, 0)
})

ok('打了分就报分', function () {
  var all = res.lines.join('\n')
  assert.ok(all.indexOf('你给自己打的是 3/5') >= 0)
})

ok('完全没数据也不报错', function () {
  var r = R.analyze({})
  assert.ok(Array.isArray(r.lines))
  assert.ok(r.lines.length > 0)
})

ok('摘录会截断长文字', function () {
  var e = R.excerpt({ note: '这是一段很长的复盘文字，用来测试摘录会不会被正确截断，应该会被截掉一部分。' })
  assert.ok(e.length <= 27)
  assert.ok(e.slice(-1) === '…')
})

ok('空文字有兜底摘录', function () {
  assert.strictEqual(R.excerpt({ note: '' }), '（只看了清单，没写文字）')
})

console.log('\n---- 生成样例 ----')
res.lines.forEach(function (l) { console.log('  ' + l) })

console.log('\n全部通过  (pass ' + pass + ', fail 0)\n')
