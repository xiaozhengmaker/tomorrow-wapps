/**
 * 进度判定：把「写到一半」「卡在等数据」这类随手写的进度，判成一个状态。
 *
 * 设计上只存文字、不存状态——判定随时可以按当前规则重算，
 * 改规则不用迁移历史数据。
 *
 * 状态从「卡住」到「写完」按严重程度排查，先命中的胜出：
 * 「做了一半，卡在等数据」应该判成卡住，而不是进行中。
 */

var RULES = [
  {
    key: 'blocked',
    label: '卡住了',
    ratio: 0.3,
    words: ['卡住', '卡在', '等回复', '没回复', '审批', '阻塞', '受阻', '找不到', '依赖', '被卡', '等数据']
  },
  {
    key: 'almost',
    label: '快好了',
    ratio: 0.85,
    words: ['快好', '差一点', '只差', '剩最后', '基本完成', '八成', '90%', '临门', '收尾', '差不多了']
  },
  {
    key: 'half',
    label: '进行中',
    ratio: 0.5,
    words: ['一半', '做到一半', '写到一半', '做了一半', '过半', '50%', '60%', '70%']
  },
  {
    key: 'started',
    label: '刚起步',
    ratio: 0.2,
    words: ['刚开始', '开了个头', '起步', '看了', '着手', '动了', '10%', '20%', '30%']
  },
  {
    key: 'notStarted',
    label: '还没动',
    ratio: 0,
    words: ['没动', '没开始', '没碰', '来不及', '没做', '没顾上', '0%', '没写完', '没做完', '没搞完']
  },
  {
    key: 'finished',
    label: '写完了',
    ratio: 1,
    words: ['做完', '已完成', '完成了', '搞定', '写完了', '交了', '弄完了']
  }
]

var NONE = { key: 'none', label: '', ratio: null }
var VAGUE = { key: 'doing', label: '有进展', ratio: 0.5 }

function judge(text) {
  var s = String(text === null || text === undefined ? '' : text).trim()
  if (!s) return copy(NONE)

  for (var i = 0; i < RULES.length; i++) {
    for (var j = 0; j < RULES[i].words.length; j++) {
      if (s.indexOf(RULES[i].words[j]) >= 0) return copy(RULES[i])
    }
  }
  // 写了但没关键词：算「有进展」，别硬判成没动
  return copy(VAGUE)
}

function copy(o) {
  return { key: o.key, label: o.label, ratio: o.ratio }
}

/**
 * 折算今天整体推进了多少（0-100）。
 * 打勾的算 1，写了进度的按状态折算，两个都没有的算 0。
 */
function ratioOf(items) {
  var list = items || []
  if (!list.length) return 0

  var sum = 0
  list.forEach(function (it) {
    if (it.done) {
      sum += 1
      return
    }
    var r = judge(it.progress).ratio
    sum += (typeof r === 'number' ? r : 0)
  })

  return Math.round((sum / list.length) * 100)
}

/** 把各项判定的状态汇总成 [{key,label,count}]，按数量从多到少 */
function tally(items) {
  var map = {}
  var order = []

  ;(items || []).forEach(function (it) {
    if (it.done) return
    var s = judge(it.progress)
    if (s.key === 'none') return
    if (!map[s.key]) {
      map[s.key] = { key: s.key, label: s.label, count: 0 }
      order.push(s.key)
    }
    map[s.key].count++
  })

  return order.map(function (k) { return map[k] }).sort(function (a, b) {
    return b.count - a.count
  })
}

module.exports = {
  judge: judge,
  ratioOf: ratioOf,
  tally: tally,
  RULES: RULES
}
