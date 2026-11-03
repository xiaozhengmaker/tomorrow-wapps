/**
 * AI 拆解的解析测试：node tests/ai.test.js
 * 重点是大模型的输出不可靠——各种脏格式都得能兜住。
 */

var assert = require('assert')
var AI = require('../utils/ai.js')

var pass = 0
function ok(name, fn) { fn(); pass++; console.log('  ok   ' + name) }

function texts(steps) { return steps.map(function (s) { return s.text }) }
function mins(steps) { return steps.map(function (s) { return s.minutes }) }

console.log('\n[1] 正常输出')

ok('标准 JSON', function () {
  var s = AI.parseSteps('{"steps":[{"text":"列出三个问题","minutes":10},{"text":"写最丑的一版","minutes":25}]}')
  assert.strictEqual(s.length, 2)
  assert.deepStrictEqual(texts(s), ['列出三个问题', '写最丑的一版'])
  assert.deepStrictEqual(mins(s), [10, 25])
})

ok('每一步都有 id', function () {
  var s = AI.parseSteps('{"steps":[{"text":"A步骤","minutes":10}]}')
  assert.ok(s[0].id)
})

console.log('\n[2] 脏输出（关键）')

ok('被 ```json 包住', function () {
  var s = AI.parseSteps('```json\n{"steps":[{"text":"第一步","minutes":15}]}\n```')
  assert.strictEqual(texts(s)[0], '第一步')
})

ok('前后带解释文字', function () {
  var s = AI.parseSteps('好的，这是拆解：\n{"steps":[{"text":"去填空","minutes":10}]}\n希望有帮助')
  assert.strictEqual(s.length, 1)
  assert.strictEqual(texts(s)[0], '去填空')
})

ok('直接返回数组', function () {
  var s = AI.parseSteps('[{"text":"先列清单","minutes":10},{"text":"再写草稿","minutes":20}]')
  assert.strictEqual(s.length, 2)
  assert.deepStrictEqual(texts(s), ['先列清单', '再写草稿'])
})

ok('模型不听话给编号列表，也能兜住', function () {
  var s = AI.parseSteps('1. 先把资料找齐\n2. 写一版草稿\n3. 发给对方')
  assert.deepStrictEqual(texts(s), ['先把资料找齐', '写一版草稿', '发给对方'])
})

ok('完全垃圾返回空数组，不抛异常', function () {
  assert.deepStrictEqual(AI.parseSteps(''), [])
  assert.deepStrictEqual(AI.parseSteps('我不太明白你的意思'), [])
  assert.deepStrictEqual(AI.parseSteps(null), [])
  assert.deepStrictEqual(AI.parseSteps('{坏掉的 json'), [])
})

console.log('\n[3] 规矩')

ok('最多 3 步', function () {
  var s = AI.parseSteps('{"steps":[{"text":"第一步"},{"text":"第二步"},{"text":"第三步"},{"text":"第四步"},{"text":"第五步"}]}')
  assert.strictEqual(s.length, 3)
  assert.deepStrictEqual(texts(s), ['第一步', '第二步', '第三步'])
})

ok('太短的步骤丢掉', function () {
  var s = AI.parseSteps('{"steps":[{"text":"A","minutes":10},{"text":"这一步是正经的","minutes":10}]}')
  assert.deepStrictEqual(texts(s), ['这一步是正经的'])
})

ok('太长的步骤丢掉（超过 40 字）', function () {
  var long = new Array(60).join('很')
  var s = AI.parseSteps('{"steps":[{"text":"正常步骤"},{"text":"' + long + '","minutes":10}]}')
  assert.deepStrictEqual(texts(s), ['正常步骤'])
})

ok('分钟数吸附到档位', function () {
  assert.strictEqual(AI.snapMinutes(7), 5)
  assert.strictEqual(AI.snapMinutes(12), 10)
  assert.strictEqual(AI.snapMinutes(15), 15)
  assert.strictEqual(AI.snapMinutes(20), 15)
  assert.strictEqual(AI.snapMinutes(27), 25)
  assert.strictEqual(AI.snapMinutes(28), 30)
  assert.strictEqual(AI.snapMinutes(500), 30)
})

ok('分钟数缺失或非法给 15', function () {
  assert.strictEqual(AI.snapMinutes(undefined), 15)
  assert.strictEqual(AI.snapMinutes('abc'), 15)
  assert.strictEqual(AI.snapMinutes(0), 15)
})

ok('数字分钟的字符串也认', function () {
  var s = AI.parseSteps('{"steps":[{"text":"正经一步","minutes":"25"}]}')
  assert.deepStrictEqual(mins(s), [25])
})

console.log('\n[4] 请求体')

ok('system 里写清了「只输出 JSON」和格式', function () {
  var req = AI.buildRequest('把季度复盘会开得有结果')
  assert.ok(req.system.indexOf('1 到 3 步') > 0)
  assert.ok(req.system.indexOf('{"steps"') > 0)
  assert.strictEqual(req.user, '把季度复盘会开得有结果')
  assert.ok(req.maxTokens > 0 && req.maxTokens <= 1500)
})

ok('目标过长会被截断', function () {
  var req = AI.buildRequest(new Array(500).join('字'))
  assert.ok(req.user.length <= 200)
})

console.log('\n全部通过  (pass ' + pass + ', fail 0)\n')
