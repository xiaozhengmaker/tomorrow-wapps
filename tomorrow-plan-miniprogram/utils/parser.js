/**
 * 核心：把一段随手写的话，拆成「带固定时间的事项」。
 *
 * 设计原则
 * 1. 纯本地规则，不联网、不花钱、不需要 API Key。
 * 2. 不依赖 wx API，可以直接用 node 跑测试。
 * 3. 每一项最后一定有一个明确的时间（写了的按写的，没写的自动排到空档），
 *    这样第二天照着清单做就行。
 */

var TAGS = ['工作', '生活', '健康', '学习', '其他']

var CN_DIGIT = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
}

// 时间段词：长的写在前面，避免「晚上」被「晚」截断
var PERIOD_WORDS = [
  '凌晨', '清晨', '早上', '早晨', '上午', '中午', '下午',
  '傍晚', '晚上', '夜里', '今晚', '明早', '明晚'
]
var PERIOD_ALT = PERIOD_WORDS.join('|')
var PERIOD_RE = new RegExp('(' + PERIOD_ALT + ')')
var PERIOD_RE_G = new RegExp('(' + PERIOD_ALT + ')', 'g')
var DAY_RE_G = /(明天|明日|今天|今日|明早|明晚|今晚)/g

// 只有时间段、没写几点时，取一个默认时刻
var PERIOD_DEFAULT = {
  '凌晨': 5 * 60 + 30,
  '清晨': 6 * 60 + 30,
  '早上': 8 * 60,
  '早晨': 8 * 60,
  '明早': 8 * 60,
  '上午': 9 * 60,
  '中午': 12 * 60,
  '下午': 14 * 60 + 30,
  '傍晚': 18 * 60,
  '晚上': 19 * 60 + 30,
  '今晚': 19 * 60 + 30,
  '明晚': 19 * 60 + 30,
  '夜里': 21 * 60
}

// 没写时间的事项，依次填进这些空档
var SLOT_POOL = [
  9 * 60,          // 09:00
  10 * 60 + 30,    // 10:30
  14 * 60,         // 14:00
  15 * 60 + 30,    // 15:30
  17 * 60,         // 17:00
  18 * 60 + 30,    // 18:30
  19 * 60 + 30,    // 19:30
  21 * 60          // 21:00
]

var IMPORTANT_KEYS = ['重要', '必须', '务必', '一定要', '紧急', '截止', 'deadline', '关键', '不能忘', '最后期限']

var TAG_RULES = [
  {
    tag: '工作',
    keys: ['开会', '会议', '客户', '汇报', '周报', '月报', '报告', '方案', '对接', '评审',
      '面试', '演示', '复盘', '沟通', '邮件', '项目', '需求', '文档', '排期', '上线', '述职', '开会']
  },
  {
    tag: '健康',
    keys: ['健身', '跑步', '运动', '游泳', '瑜伽', '锻炼', '体检', '吃药', '午睡', '睡觉',
      '喝水', '散步', '打球', '爬', '理疗', '看牙', '早睡']
  },
  {
    tag: '学习',
    keys: ['学习', '看书', '读书', '背单词', '英语', '课程', '作业', '复习', '笔记', '听课',
      '刷题', '练习', '练习', '文献']
  },
  {
    tag: '生活',
    keys: ['买', '菜', '快递', '取件', '洗衣', '打扫', '收拾', '做饭', '缴费', '交费', '还',
      '房租', '水费', '电费', '燃气', '充值', '理发', '剪', '接', '送', '洗车', '油']
  }
]

/* ------------------------------ 小工具 ------------------------------ */

/** 中文数字 / 阿拉伯数字 -> number（支持 0-99） */
function cnToNum(str) {
  if (str === null || str === undefined || str === '') return null
  var s = String(str).trim()
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  if (s === '十') return 10
  var m = s.match(/^([一二两三四五六七八九])十([一二三四五六七八九])?$/)
  if (m) {
    var tens = CN_DIGIT[m[1]]
    var ones = m[2] ? CN_DIGIT[m[2]] : 0
    return tens * 10 + ones
  }
  if (CN_DIGIT[s] !== undefined) return CN_DIGIT[s]
  return null
}

/** 全角数字、全角冒号、全角空格统一成半角 */
function normalize(text) {
  var s = String(text === null || text === undefined ? '' : text)
  var out = ''
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i)
    var idx = '０１２３４５６７８９'.indexOf(ch)
    if (idx >= 0) out += String(idx)
    else if (ch === '：') out += ':'
    else if (ch === '　') out += ' '
    else if (ch === '，') out += ','
    else if (ch === '；') out += ';'
    else if (ch === '？') out += '?'
    else if (ch === '！') out += '!'
    else if (ch === '、') out += ','
    else out += ch
  }
  return out
}

function hasTimeWord(s) {
  if (!s) return false
  if (PERIOD_RE.test(s)) return true
  if (/\d{1,2}\s*[点时]/.test(s)) return true
  if (/\d{1,2}\s*:\s*\d{1,2}/.test(s)) return true
  if (/[一二两三四五六七八九十]{1,3}\s*[点时]/.test(s)) return true
  return false
}

/** 句子切成候选事项 */
function splitSegments(text) {
  var chunks = []
  var lines = String(text).split(/\n+/)

  lines.forEach(function (line) {
    var raw = line.replace(/^\s*(?:\d{1,2}\s*[.,、)\]]|[-*•·+])\s*/, '').trim()
    if (!raw) return

    // 先按真正的句子边界切
    var sentences = raw.split(/[;。!?]+/)
    sentences.forEach(function (sentence) {
      var s = sentence.trim()
      if (!s) return

      var parts
      if (hasTimeWord(s)) {
        // 有时间的句子：只在「逗号后面紧跟着时间词」时再切一刀
        var re = new RegExp(',(?=\\s*(?:' + PERIOD_ALT + '|\\d{1,2}\\s*[点时]|明天|明日))')
        parts = s.split(re)
      } else {
        // 没有时间的句子：逗号隔开的短句基本就是并列的几件事
        var byComma = s.split(',').map(function (x) { return x.trim() }).filter(Boolean)
        var allShort = byComma.length > 1 && byComma.every(function (x) {
          return x.length >= 2 && x.length <= 14
        })
        parts = allShort ? byComma : [s]
      }

      parts.forEach(function (p) {
        var q = p.trim().replace(/^[,;:.\s]+/, '').replace(/[,;:.\s]+$/, '')
        if (q) chunks.push(q)
      })
    })
  })

  return chunks
}

/** 抽时长：返回 { minutes, matched } */
function extractDuration(chunk) {
  var m

  // 「一个半小时」「2 个半小时」
  m = chunk.match(/(\d+|[一二两三四五六七八九十]+)\s*个\s*半\s*个?\s*(?:小时|钟头)/)
  if (m) {
    var n1 = cnToNum(m[1])
    if (n1) return { minutes: n1 * 60 + 30, matched: m[0] }
  }

  // 「半小时」「半个钟头」
  m = chunk.match(/半\s*个?\s*(?:小时|钟头)/)
  if (m) return { minutes: 30, matched: m[0] }

  // 「1.5 小时」「两小时」「3 小时」
  m = chunk.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十]+)\s*个?\s*(?:小时|钟头|h|H)/)
  if (m) {
    var v = /^\d/.test(m[1]) ? parseFloat(m[1]) : cnToNum(m[1])
    if (v !== null && !isNaN(v) && v > 0) return { minutes: Math.round(v * 60), matched: m[0] }
  }

  // 「30 分钟」「十分钟」「45min」
  m = chunk.match(/(\d+|[一二两三四五六七八九十]+)\s*(?:分钟|分|min|Min)/)
  if (m) {
    var v2 = cnToNum(m[1])
    if (v2 !== null && v2 > 0) return { minutes: v2, matched: m[0] }
  }

  return { minutes: 0, matched: null }
}

/** 上下午换算 */
function applyPeriod(hour, period) {
  if (!period) {
    // 没写上下午，1~5 点按下午理解（「3点」多半是 15:00）
    if (hour >= 1 && hour <= 5) return hour + 12
    return hour
  }
  if (period === '凌晨') return hour === 12 ? 0 : hour
  if (period === '中午') return hour < 6 ? hour + 12 : hour
  if (period === '下午') return hour < 12 ? hour + 12 : hour
  if (period === '傍晚' || period === '晚上' || period === '今晚' ||
      period === '明晚' || period === '夜里') {
    if (hour === 12) return 0
    return hour < 12 ? hour + 12 : hour
  }
  // 早上 / 早晨 / 清晨 / 上午 / 明早
  return hour
}

/** 抽时间：返回 { hour, minute, matched, period, periodOnly } 或 null */
function extractTime(chunk) {
  var period = null
  var pm = chunk.match(PERIOD_RE)
  if (pm) period = pm[1]

  // 12:30 / 9:05
  var hm = chunk.match(/(\d{1,2})\s*:\s*(\d{1,2})/)
  if (hm) {
    var h = parseInt(hm[1], 10)
    var mi = parseInt(hm[2], 10)
    if (mi > 59) mi = 0
    if (h <= 24) {
      return { hour: applyPeriod(h, period), minute: mi, matched: hm[0], period: period }
    }
  }

  // 9点 / 九点半 / 下午3点15分
  var dian = chunk.match(
    /(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*点(?:\s*(半|\d{1,2}|[一二三四五六七八九十]{1,2})\s*分?)?/
  )
  if (dian) {
    var hh = cnToNum(dian[1])
    if (hh !== null && hh >= 0 && hh <= 24) {
      var mm = 0
      if (dian[2]) {
        if (dian[2] === '半') mm = 30
        else {
          var v = cnToNum(dian[2])
          mm = v === null ? 0 : v
        }
      }
      if (mm > 59) mm = 0
      return { hour: applyPeriod(hh, period), minute: mm, matched: dian[0], period: period }
    }
  }

  // 只说了「下午」「晚上」这种
  if (period) {
    return { hour: null, minute: null, matched: null, period: period, periodOnly: true }
  }
  return null
}

/** 猜标签 */
function guessTag(title) {
  for (var i = 0; i < TAG_RULES.length; i++) {
    var rule = TAG_RULES[i]
    for (var j = 0; j < rule.keys.length; j++) {
      if (title.indexOf(rule.keys[j]) >= 0) return rule.tag
    }
  }
  return '其他'
}

/** 猜时长（分钟） */
function guessDuration(title) {
  if (/会议|开会|见面|面试|汇报|评审|演示|培训|聚餐|述职|复盘会/.test(title)) return 60
  if (/健身|运动|跑步|游泳|锻炼|瑜伽|打球/.test(title)) return 60
  if (/吃饭|午餐|晚餐|午饭|晚饭|早饭|做饭/.test(title)) return 45
  if (/写|整理|复盘|周报|月报|方案|报告|文档|PPT|ppt/.test(title)) return 45
  if (/打电话|沟通|聊|对接/.test(title)) return 30
  return 30
}

function isImportant(chunk) {
  for (var i = 0; i < IMPORTANT_KEYS.length; i++) {
    if (String(chunk).toLowerCase().indexOf(IMPORTANT_KEYS[i].toLowerCase()) >= 0) return true
  }
  return false
}

var LEADING_FILLER = /^(?:我|要|需要|得|应该|打算|计划|准备|大概|约|记得|别忘了|别忘|然后|另外|还有|注意|先|再|的)+/
var TRAILING_FILLER = /(?:大概|左右|差不多|的样子|这样|一下|吧|哦|啊|呢|呀|啦|了|就可以了|就行了|就好|就行)$/

// 这些词里含时段词，但它们是完整名词，不能被当成「时间」
var GUARD_RE = /下午茶|下午场|上午场/g
var GUARD_RESTORE_RE = /\uE000([A-Z])\uE001/g

/** 清了时间、时长之后，剩下的话就是事项标题 */
function cleanTitle(raw) {
  if (!raw) return ''
  var t = String(raw)
  t = t.replace(DAY_RE_G, ' ')
  t = t.replace(PERIOD_RE_G, ' ')
  t = t.replace(/[,\s]+/g, ' ').trim()
  t = t.replace(LEADING_FILLER, '')
  t = t.replace(/^的\s*/, '')
  var guard = 0
  while (guard < 4 && TRAILING_FILLER.test(t)) {
    t = t.replace(TRAILING_FILLER, '')
    guard++
  }
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

var idSeq = 0
function makeId() {
  idSeq += 1
  return 'i' + Date.now().toString(36) + idSeq.toString(36) +
    Math.floor(Math.random() * 1296).toString(36)
}

/**
 * 主入口
 * @param {string} text 用户随手写的一段话
 * @param {object} opts { now:Date }
 * @return {Array} 已经排好时间的事项
 */
function parse(text, opts) {
  opts = opts || {}
  var src = normalize(text)
  if (!src || !src.trim()) return []

  var chunks = splitSegments(src)
  var draft = []

  chunks.forEach(function (chunk, order) {
    var guards = []
    // 「下午茶」这类词先藏起来，避免被当成「下午 + 茶」
    chunk = chunk.replace(GUARD_RE, function (word) {
      var idx = guards.length
      guards.push(word)
      return '\uE000' + String.fromCharCode(65 + idx) + '\uE001'
    })

    var dur = extractDuration(chunk)
    var rest = dur.matched ? chunk.replace(dur.matched, ' ') : chunk

    var t = extractTime(rest)
    var body = rest
    if (t && t.matched) body = body.replace(t.matched, ' ')

    // 把时间词全部摘掉，剩下的才是「要做的事」
    var residual = body.replace(DAY_RE_G, ' ').replace(PERIOD_RE_G, ' ')
    var compact = residual.replace(/[\s,.;:!?、。…—\-]/g, '')
    if (!compact) return // 整句只有时间，没有事可做

    var title = cleanTitle(body)
    if (!title) title = compact
    title = title.replace(GUARD_RESTORE_RE, function (all, letter) {
      var i = letter.charCodeAt(0) - 65
      return guards[i] || ''
    })
    if (!title) return

    var minutes = null
    if (t && t.hour !== null && t.hour !== undefined) {
      minutes = t.hour * 60 + t.minute
    } else if (t && t.periodOnly) {
      minutes = PERIOD_DEFAULT[t.period]
    }

    draft.push({
      title: title,
      minutes: minutes,
      duration: dur.minutes || guessDuration(title),
      tag: guessTag(title),
      important: isImportant(chunk),
      assigned: false,
      order: order
    })
  })

  // 去重：同样的标题 + 同样的时间
  var seen = {}
  draft = draft.filter(function (it) {
    var key = it.title + '@' + (it.minutes === null ? 'auto' : it.minutes)
    if (seen[key]) return false
    seen[key] = 1
    return true
  })

  assignTimes(draft)

  draft.sort(function (a, b) {
    if (a.minutes !== b.minutes) return a.minutes - b.minutes
    return a.order - b.order
  })

  return draft.map(function (it) {
    return {
      id: makeId(),
      title: it.title,
      time: toHHMM(it.minutes),
      duration: it.duration,
      tag: it.tag,
      important: it.important,
      assigned: it.assigned,
      done: false
    }
  })
}

function toHHMM(m) {
  var h = Math.floor(m / 60)
  var mi = m % 60
  return (h < 10 ? '0' + h : '' + h) + ':' + (mi < 10 ? '0' + mi : '' + mi)
}

/** 没写时间的事项，按顺序填进空档 */
function assignTimes(items) {
  var used = {}
  items.forEach(function (it) {
    if (it.minutes !== null) used[it.minutes] = true
  })

  var slotIndex = 0
  items.forEach(function (it) {
    if (it.minutes !== null) return

    var picked = null
    while (slotIndex < SLOT_POOL.length) {
      var cand = SLOT_POOL[slotIndex]
      slotIndex++
      if (!used[cand]) { picked = cand; break }
    }

    if (picked === null) {
      var latest = 9 * 60
      Object.keys(used).forEach(function (k) {
        var v = parseInt(k, 10)
        if (v > latest) latest = v
      })
      picked = latest + 30
      while (used[picked] && picked < 23 * 60) picked += 15
    }

    used[picked] = true
    it.minutes = picked
    it.assigned = true
  })
}

/** 把一段话直接变成某个日期的清单对象 */
function parsePlan(text, dateStr) {
  var items = parse(text)
  return {
    date: dateStr || '',
    source: String(text || '').trim(),
    items: items
  }
}

module.exports = {
  TAGS: TAGS,
  parse: parse,
  parsePlan: parsePlan,
  cnToNum: cnToNum,
  normalize: normalize,
  splitSegments: splitSegments,
  extractTime: extractTime,
  extractDuration: extractDuration,
  cleanTitle: cleanTitle,
  guessTag: guessTag,
  guessDuration: guessDuration,
  toHHMM: toHHMM
}
