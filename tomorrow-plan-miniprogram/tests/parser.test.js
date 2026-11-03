/**
 * 本地跑一遍解析引擎，不依赖微信开发者工具：
 *   node tests/parser.test.js
 */

var parser = require('../utils/parser.js')

var pass = 0
var fail = 0

function check(name, actual, expected) {
  var a = JSON.stringify(actual)
  var e = JSON.stringify(expected)
  if (a === e) {
    pass++
    console.log('  ok   ' + name)
  } else {
    fail++
    console.log('  FAIL ' + name)
    console.log('       期望: ' + e)
    console.log('       实际: ' + a)
  }
}

function brief(items) {
  return items.map(function (i) {
    return [i.time, i.title, i.duration, i.tag, i.important ? '!' : ''].join(' | ')
  })
}

function times(items) {
  return items.map(function (i) { return i.time })
}

function titles(items) {
  return items.map(function (i) { return i.title })
}

console.log('\n[1] 中文数字 + 分钟')
var a = parser.parse('明天上午九点跟客户开会，大概一小时')
check('条数', a.length, 1)
check('时间', times(a), ['09:00'])
check('标题', titles(a), ['跟客户开会'])
check('时长', a[0].duration, 60)
check('标签', a[0].tag, '工作')

console.log('\n[2] 只有时段词')
var b = parser.parse('下午写周报')
check('时间', times(b), ['14:30'])
check('标题', titles(b), ['写周报'])

console.log('\n[3] 晚上 + 中文数字')
var c = parser.parse('晚上八点健身')
check('时间', times(c), ['20:00'])
check('标签', c[0].tag, '健康')

console.log('\n[4] HH:mm 写法')
var d = parser.parse('9:30 面试')
check('时间', times(d), ['09:30'])
check('时长', d[0].duration, 60)

console.log('\n[5] 半点 + 下午换算')
var e = parser.parse('下午3点半 复盘会')
check('时间', times(e), ['15:30'])

console.log('\n[6] 一个半小时')
var f = parser.parse('2个半小时的培训')
check('时长', f[0].duration, 150)

console.log('\n[7] 一句话三件事，逗号隔开')
var g = parser.parse('买菜，写周报，去健身')
check('条数', g.length, 3)
check('标题', titles(g), ['买菜', '写周报', '去健身'])
check('自动排时间', times(g), ['09:00', '10:30', '14:00'])
check('标记为自动', g.map(function (i) { return i.assigned }), [true, true, true])

console.log('\n[8] 多行混合，自动时间要避开已占用的')
var h = parser.parse('上午九点开会\n买菜\n下午茶\n写周报')
console.log('       ' + brief(h).join('\n       '))
check('按时间排序', times(h), ['09:00', '10:30', '14:00', '15:30'])
check('下午茶不被拆开', titles(h), ['开会', '买菜', '下午茶', '写周报'])

console.log('\n[9] 空输入')
check('空字符串', parser.parse('').length, 0)
check('纯空白', parser.parse('   \n  ').length, 0)

console.log('\n[10] 重要标记')
var i10 = parser.parse('明天必须交电费')
check('标记重要', i10[0].important, true)
check('标题去掉必须', titles(i10), ['必须交电费'])

console.log('\n[11] 全角数字与冒号')
var i11 = parser.parse('下午１４：３０ 面试')
check('时间', times(i11), ['14:30'])

console.log('\n[12] 列表序号')
var i12 = parser.parse('1. 写周报\n2、体检\n3) 给妈妈打电话')
check('条数', i12.length, 3)

console.log('\n[13] 超过空档数量也不炸')
var many = []
for (var k = 0; k < 12; k++) many.push('事情' + k)
var i13 = parser.parse(many.join('\n'))
check('条数', i13.length, 12)
check('时间不重复', new Set(times(i13)).size, 12)
console.log('       ' + times(i13).join(' '))

console.log('\n[14] 只有时间没有内容')
var i14 = parser.parse('明天下午三点')
check('不产生空事项', i14.length, 0)

console.log('\n' + (fail === 0 ? '全部通过' : '失败 ' + fail + ' 条') + '  (pass ' + pass + ', fail ' + fail + ')')
process.exit(fail === 0 ? 0 : 1)
