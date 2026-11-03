/**
 * Markdown 日记生成测试：node tests/diary.test.js
 */

var assert = require('assert')
var Diary = require('../utils/diary.js')

var pass = 0
function ok(name, fn) { fn(); pass++; console.log('  ok   ' + name) }

var PLAN = {
  date: '2026-10-30',
  items: [
    { title: '写周报', time: '09:00', duration: 45, tag: '工作', done: true },
    { title: '找素材', time: '10:30', duration: 30, tag: '工作', done: false, progress: '做了一半，卡在等数据' },
    { title: '健身', time: '20:00', duration: 60, tag: '健康', done: false, progress: '还没动' }
  ]
}

var REVIEW = {
  date: '2026-10-30',
  note: '上午开会超时，客户电话没打；晚上太累。',
  lines: [
    '没打勾的是：找素材、健身。',
    '写了进度的 2 项：找素材「卡住了」、健身「还没动」。'
  ],
  score: 3
}

var md = Diary.render({ date: '2026-10-30', plan: PLAN, review: REVIEW })

console.log('\n[1] 结构')

ok('开头是 frontmatter', function () {
  assert.ok(md.startsWith('---\n'))
})

ok('frontmatter 是闭合的', function () {
  var parts = md.split('---\n')
  assert.ok(parts.length >= 3, '应该有三段')
})

ok('frontmatter 里字段齐全', function () {
  assert.ok(md.indexOf('date: 2026-10-30') >= 0)
  assert.ok(md.indexOf('weekday: 周五') >= 0)
  assert.ok(md.indexOf('done: 1') >= 0)
  assert.ok(md.indexOf('total: 3') >= 0)
  assert.ok(md.indexOf('rate: 33') >= 0)
  assert.ok(md.indexOf('score: 3') >= 0)
})

ok('有一级标题和两个小节', function () {
  assert.ok(md.indexOf('# 2026-10-30 周五') >= 0)
  assert.ok(md.indexOf('## 清单') >= 0)
  assert.ok(md.indexOf('## 复盘') >= 0)
})

console.log('\n[2] 清单渲染')

ok('按时间排序', function () {
  var a = md.indexOf('写周报')
  var b = md.indexOf('找素材')
  var c = md.indexOf('健身')
  assert.ok(a < b && b < c, '应该 09:00 -> 10:30 -> 20:00')
})

ok('完成的用 [x]，没完成用 [ ]', function () {
  assert.ok(md.indexOf('- [x] `09:00` 写周报') >= 0)
  assert.ok(md.indexOf('- [ ] `10:30` 找素材') >= 0)
})

ok('带上分类和时长', function () {
  assert.ok(md.indexOf('写周报 · 工作 · 45 分钟') >= 0)
})

ok('进度缩进成子项，并带判定结果', function () {
  assert.ok(md.indexOf('  - 进度：做了一半，卡在等数据 → 卡住了') >= 0)
  assert.ok(md.indexOf('  - 进度：还没动 → 还没动') >= 0)
})

ok('没写进度的项不产生空的子项', function () {
  var lines = md.split('\n')
  var idx = lines.findIndex(function (l) { return l.indexOf('写周报') >= 0 })
  assert.ok(lines[idx + 1].indexOf('进度') < 0, '下划线那行不应该是进度')
})

console.log('\n[3] 复盘渲染')

ok('复盘原文变成引用块', function () {
  assert.ok(md.indexOf('> 上午开会超时，客户电话没打；晚上太累。') >= 0)
})

ok('评估结论变成列表', function () {
  assert.ok(md.indexOf('- 没打勾的是：找素材、健身。') >= 0)
})

ok('自评单独一行', function () {
  assert.ok(md.indexOf('自评：3 / 5') >= 0)
})

console.log('\n[4] 边界')

ok('文件名是 YYYY-MM-DD.md', function () {
  assert.strictEqual(Diary.filename('2026-10-30'), '2026-10-30.md')
})

ok('空日子 hasContent 为 false', function () {
  assert.strictEqual(Diary.hasContent({ date: '2026-10-30', plan: null, review: null }), false)
  assert.strictEqual(Diary.hasContent({ plan: { items: [] } }), false)
})

ok('有清单就是 true', function () {
  assert.strictEqual(Diary.hasContent({ plan: PLAN }), true)
})

ok('只有复盘也是 true', function () {
  assert.strictEqual(Diary.hasContent({ review: REVIEW }), true)
})

ok('没有清单时不报错', function () {
  var empty = Diary.render({ date: '2026-10-30' })
  assert.ok(empty.indexOf('这一天没有排清单。') >= 0)
  assert.ok(empty.indexOf('done: 0') >= 0)
})

ok('标题里的反引号和竖线被清掉，不会破坏格式', function () {
  var bad = Diary.render({
    date: '2026-10-30',
    plan: { items: [
      { title: '改 `config` | 配置', time: '09:00', duration: 10, tag: '工作', done: false }
    ] }
  })
  var line = bad.split('\n').filter(function (l) { return l.indexOf('配置') >= 0 })[0]
  assert.ok(line, '应该找到那一行')
  assert.ok(line.indexOf('config') >= 0, '内容本身要保留')
  assert.strictEqual(line.indexOf('|'), -1, '竖线必须清掉')
  assert.ok(line.split('`').length === 3, '只剩时间那对反引号')
})

ok('多行复盘每行都带引用符', function () {
  var multi = Diary.render({
    date: '2026-10-30',
    review: { note: '第一行\n第二行', lines: [] }
  })
  assert.ok(multi.indexOf('> 第一行\n> 第二行') >= 0)
})

console.log('\n[5] 归档格式（Obsidian）')

ok('frontmatter 能被 YAML 解析的样子：每个字段一行、标签是列表', function () {
  var fm = md.split('---\n')[1]
  var lines = fm.trim().split('\n')
  lines.forEach(function (l) {
    assert.ok(/^(date|weekday|type|tags|  - |done|total|rate|progress|score)/.test(l), '可疑的 frontmatter 行: ' + l)
  })
})

ok('参与折算的 progress 字段只在写了进度时出现', function () {
  var noProg = Diary.render({
    date: '2026-10-30',
    plan: { items: [{ title: 'A', time: '09:00', duration: 10, tag: '工作', done: true }] }
  })
  assert.ok(noProg.indexOf('progress:') < 0)
})

console.log('\n---- 生成样例 ----')
console.log(md)

console.log('全部通过  (pass ' + pass + ', fail 0)\n')
