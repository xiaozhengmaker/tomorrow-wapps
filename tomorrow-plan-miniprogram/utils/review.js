/**
 * 复盘：把「今天清单的打勾情况 + 20 点写的一段话」变成一段中性的评估。
 *
 * 口径是「中性」（用户确认过）：
 *   只陈述事实和数字，不夸奖、不批评、不给建议、不灌鸡汤。
 *   判断留给人，程序只负责把事实摆清楚。
 */

var progressUtil = require('./progress.js')

var REASON_RULES = [  {
    key: 'time',
    label: '时间不够',
    words: ['来不及', '没时间', '时间不够', '太忙', '加班', '赶不及', '拖到']
  },
  {
    key: 'interrupt',
    label: '被打断',
    words: ['开会', '临时', '被打断', '插进来', '被叫走', '突然']
  },
  {
    key: 'extra',
    label: '临时多出的事',
    words: ['又加', '额外', '插队', '紧急', '多做了']
  },
  {
    key: 'blocked',
    label: '卡在别人那里',
    words: ['卡住', '等回复', '没回复', '没人回', '审批', '找不到', '依赖']
  },
  {
    key: 'avoid',
    label: '没开始',
    words: ['不想', '懒得', '没动', '拖延', '拖了', '状态差', '太累', '放弃']
  }
]

var DONE_WORDS = ['搞定', '完成了', '做完', '写完了', '顺利', '搞完', '解决']

function countWord(text, word) {
  if (!text || !word) return 0
  var n = 0
  var from = 0
  while (true) {
    var idx = text.indexOf(word, from)
    if (idx < 0) break
    n++
    from = idx + word.length
  }
  return n
}

/** 事项标题里的「双字片段」，用来判断这件事在复盘里被提到没有 */
function bigrams(title) {
  var s = String(title || '').replace(/[的了我去要把给和跟与、，,。\s]/g, '')
  var out = []
  for (var i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

function isMentioned(title, note) {
  if (!note) return false
  var grams = bigrams(title)
  if (!grams.length) return false
  for (var i = 0; i < grams.length; i++) {
    if (note.indexOf(grams[i]) >= 0) return true
  }
  return false
}

function detectReasons(note) {
  var text = String(note || '')
  var hits = []
  REASON_RULES.forEach(function (rule) {
    rule.words.forEach(function (w) {
      var n = countWord(text, w)
      if (n > 0) hits.push({ key: rule.key, label: rule.label, word: w, count: n })
    })
  })
  return hits
}

function tagCount(items) {
  var map = {}
  ;(items || []).forEach(function (it) {
    var tag = it.tag || '其他'
    map[tag] = (map[tag] || 0) + 1
  })
  return map
}

function joinTitles(items, limit) {
  return (items || []).slice(0, limit || 6).map(function (it) {
    return it.title
  }).join('、')
}

function percent(a, b) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

/**
 * @param {object} opts { plan, note, score, date }
 * @return {object} { lines, total, doneCount, undoneCount, rate, mentions, reasons }
 */
function analyze(opts) {
  opts = opts || {}
  var plan = opts.plan
  var note = String(opts.note || '').trim()
  var items = (plan && plan.items) ? plan.items : []

  var done = items.filter(function (it) { return it.done })
  var undone = items.filter(function (it) { return !it.done })
  var total = items.length
  var rate = percent(done.length, total)

  var lines = []

  if (!total) {
    lines.push('今天没有清单，只有你写的这段文字。')
  } else {
    lines.push('计划 ' + total + ' 项，完成 ' + done.length + ' 项（' + rate + '%）。')
  }

  if (done.length) {
    lines.push('完成的是：' + joinTitles(done) + '。')

    var doneTags = tagCount(done)
    var tagParts = []
    Object.keys(doneTags).forEach(function (k) {
      tagParts.push(k + ' ' + doneTags[k] + ' 项')
    })
    if (tagParts.length > 1) {
      lines.push('完成的这些里：' + tagParts.join('，') + '。')
    }
  }

  // 进度：先算出来，后面几行都要用
  var judged = []
  var silent = []
  items.forEach(function (it) {
    if (it.done) return
    var s = progressUtil.judge(it.progress)
    if (s.key === 'none') silent.push(it)
    else judged.push({ title: it.title, label: s.label, key: s.key })
  })

  if (undone.length) {
    // 写了进度就别再说人家「没动」，那是不准确的
    var undoneLabel = judged.length ? '没打勾的是' : '没动的是'
    lines.push(undoneLabel + '：' + joinTitles(undone) + '。')
    if (undone.length * 2 > total) {
      lines.push('超过一半的计划还没打勾。')
    }
  }

  if (judged.length) {
    var parts = judged.slice(0, 5).map(function (j) {
      return j.title + '「' + j.label + '」'
    })
    lines.push('写了进度的 ' + judged.length + ' 项：' + parts.join('、') + '。')
  }

  // 全都既没打勾也没写进度时，「没动的是」已经说过了，不再重复
  if (silent.length && judged.length) {
    lines.push('既没打勾也没写进度的：' + joinTitles(silent) + '。')
  }

  var progressed = progressUtil.ratioOf(items)
  if (judged.length && total) {
    lines.push('按进度折算，今天整体推进约 ' + progressed + '%。')
  }

  if (!note) {
    lines.push('今天没有写复盘文字，以上只有清单数据。')
  } else {
    var hits = detectReasons(note)
    if (hits.length) {
      var parts = hits.slice(0, 4).map(function (h) {
        return h.word + ' ×' + h.count
      })
      lines.push('你写的话里出现：' + parts.join('、') + '。')
    } else {
      lines.push('你写的话里没有出现明显的原因词。')
    }

    var mentioned = undone.filter(function (it) {
      return isMentioned(it.title, note)
    })
    if (mentioned.length) {
      lines.push('没完成的事项里，你提到了：' + joinTitles(mentioned) + '。')
    }

    var doneWords = 0
    DONE_WORDS.forEach(function (w) { doneWords += countWord(note, w) })
    if (doneWords > 0) {
      lines.push('文字里提到「完成」一类的说法 ' + doneWords + ' 次。')
    }
  }

  if (opts.score) {
    lines.push('你给自己打的是 ' + opts.score + '/5。')
  }

  return {
    date: opts.date || '',
    lines: lines,
    total: total,
    doneCount: done.length,
    undoneCount: undone.length,
    rate: rate,
    progressRatio: progressed,
    judgedCount: judged.length,
    silentCount: silent.length,
    reasons: detectReasons(note),
    mentions: undone.filter(function (it) { return isMentioned(it.title, note) })
      .map(function (it) { return it.title }),
    note: note,
    score: opts.score || 0
  }
}

/** 复盘记录的一句话摘录，给历史列表用 */
function excerpt(review) {
  var note = String((review && review.note) || '').replace(/\s+/g, ' ').trim()
  if (!note) return '（只看了清单，没写文字）'
  return note.length > 26 ? note.slice(0, 26) + '…' : note
}

module.exports = {
  analyze: analyze,
  excerpt: excerpt,
  detectReasons: detectReasons,
  isMentioned: isMentioned,
  REASON_RULES: REASON_RULES
}
