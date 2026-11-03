/**
 * AI 拆解。
 *
 * 策略是「本地先出结果，AI 回来了再替换」——
 * 用户点完立刻看到卡片，不用盯着转圈等大模型；
 * AI 挂了、没配 key、超时，都安静地保持模板版本，功能不退化。
 */

var cloud = require('./cloud.js')

var STEP_POOL = [5, 10, 15, 25, 30]

var SYSTEM = [
  '你是帮人把模糊目标拆成具体动作的助手。',
  '规则：',
  '1. 拆成 1 到 3 步，每步必须是一个动作，不要写「好好想想」这类空话。',
  '2. 每步 5 到 30 分钟能做完，有明确终点，做完就知道下一步。',
  '3. 不要解释、不要寒暄，只输出 JSON。',
  '输出格式：{"steps":[{"text":"做什么","minutes":15}]}'
].join('\n')

var idSeq = 0
function makeId() {
  idSeq += 1
  return 'a' + Date.now().toString(36) + idSeq.toString(36)
}

function buildRequest(goal) {
  return {
    system: SYSTEM,
    user: String(goal || '').slice(0, 200),
    maxTokens: 400,
    temperature: 0.3
  }
}

/** 从模型输出里抠出 JSON：可能被 ```json 包着，也可能前后带解释 */
function extractJson(text) {
  var s = String(text === null || text === undefined ? '' : text).trim()
  if (!s) return null

  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()

  // 整体就是 JSON
  try { return JSON.parse(s) } catch (e) {}

  // 从里面抠一个对象出来
  var start = s.indexOf('{')
  var end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)) } catch (e) {}
  }

  // 再试数组（模型直接吐 [{...}] 的情况）
  var a = s.indexOf('[')
  var b = s.lastIndexOf(']')
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)) } catch (e) {}
  }

  return null
}

/** 把分钟数吸附到允许的档位，越界就夹住 */
function snapMinutes(value) {
  var n = Number(value)
  if (!isFinite(n) || n <= 0) return 15
  if (n <= 5) return 5
  if (n >= 30) return 30

  var best = STEP_POOL[0]
  var diff = Math.abs(n - best)
  for (var i = 1; i < STEP_POOL.length; i++) {
    var d = Math.abs(n - STEP_POOL[i])
    if (d < diff) { diff = d; best = STEP_POOL[i] }
  }
  return best
}

/** 兜底：模型不听话，输出了编号列表 */
function parseNumberedList(text) {
  var lines = String(text || '').split(/\r?\n/)
  var out = []

  lines.forEach(function (line) {
    if (out.length >= 3) return
    var m = line.match(/^\s*(?:\d{1,2}[.、)）]|[-*•])\s*(.+?)\s*$/)
    if (!m) return
    var item = m[1].replace(/[。；]+$/, '').trim()
    if (item.length < 2 || item.length > 40) return
    out.push({ id: makeId(), text: item, minutes: 15 })
  })

  return out
}

/**
 * 把模型输出解析成步骤数组。纯函数，方便单测。
 * @return {Array} [{id, text, minutes}]，解析不出来返回 []
 */
function parseSteps(text) {
  var data = extractJson(text)
  var raw = []

  if (data && Array.isArray(data.steps)) raw = data.steps
  else if (Array.isArray(data)) raw = data

  var steps = []
  raw.slice(0, 3).forEach(function (item) {
    if (!item) return

    var text2 = typeof item === 'string' ? item : item.text
    text2 = String(text2 === null || text2 === undefined ? '' : text2)
      .replace(/\s+/g, ' ')
      .trim()

    if (text2.length < 2 || text2.length > 40) return

    steps.push({
      id: makeId(),
      text: text2,
      minutes: snapMinutes(typeof item === 'object' ? item.minutes : 15)
    })
  })

  if (steps.length === 2 || steps.length === 1 || steps.length === 3) return steps

  return parseNumberedList(text)
}

/** 问 AI 拆一次。失败一律返回 null，调用方回落模板 */
function breakdown(goal) {
  if (!cloud.available()) return Promise.resolve(null)

  return cloud.call('askAI', buildRequest(goal))
    .then(function (res) {
      if (!res || !res.ok) return null
      var steps = parseSteps(res.text)
      return steps.length ? steps : null
    })
    .catch(function () {
      return null
    })
}

module.exports = {
  breakdown: breakdown,
  parseSteps: parseSteps,
  extractJson: extractJson,
  snapMinutes: snapMinutes,
  buildRequest: buildRequest,
  STEP_POOL: STEP_POOL
}
