/**
 * 把某一天的清单 + 复盘，渲染成一篇 Markdown 日记。
 *
 * 带 YAML frontmatter，Obsidian 里能直接用标签、dataview 检索；
 * 清单用 `- [x]` 写法，Obsidian 的 Tasks 插件认。
 *
 * 纯函数，不碰 wx、不碰网络，node 里能直接测。
 */

var dateUtil = require('./date.js')
var progressUtil = require('./progress.js')

/** 标题里可能出现反引号、竖线这类会破坏 Markdown 的字符 */
function safe(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[`|]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim()
}

/** 多行文字变成 blockquote */
function quote(text) {
  var lines = String(text || '').split(/\r?\n/)
  return lines.map(function (l) { return '> ' + l }).join('\n')
}

function countDone(items) {
  var n = 0
  items.forEach(function (it) { if (it.done) n++ })
  return n
}

function sortByTime(items) {
  return items.slice().sort(function (a, b) {
    return dateUtil.hhmmToMinutes(a.time) - dateUtil.hhmmToMinutes(b.time)
  })
}

/**
 * @param {object} day { date, plan, review }
 * @return {string} Markdown 全文（以换行结尾）
 */
function render(day) {
  day = day || {}
  var plan = day.plan
  var review = day.review
  var dateStr = day.date || dateUtil.today()
  var items = sortByTime((plan && plan.items) ? plan.items : [])

  var total = items.length
  var done = countDone(items)
  var rate = total ? Math.round(done / total * 100) : 0
  var progressed = total ? progressUtil.ratioOf(items) : 0
  var hasProgress = items.some(function (it) {
    return !it.done && progressUtil.judge(it.progress).key !== 'none'
  })

  var out = []

  /* ---------- frontmatter ---------- */
  out.push('---')
  out.push('date: ' + dateStr)
  out.push('weekday: ' + dateUtil.weekday(dateStr))
  out.push('type: daily')
  out.push('tags:')
  out.push('  - 明日清单')
  out.push('  - daily')
  out.push('done: ' + done)
  out.push('total: ' + total)
  out.push('rate: ' + rate)
  if (hasProgress) out.push('progress: ' + progressed)
  if (review && review.score) out.push('score: ' + review.score)
  out.push('---')
  out.push('')

  /* ---------- 标题与总览 ---------- */
  out.push('# ' + dateStr + ' ' + dateUtil.weekday(dateStr))
  out.push('')

  if (!total) {
    out.push('这一天没有排清单。')
    out.push('')
  } else {
    var overview = '完成 **' + done + ' / ' + total + '** 项（' + rate + '%）'
    if (hasProgress) overview += '，进度折算约 ' + progressed + '%'
    out.push(overview + '。')
    out.push('')

    out.push('## 清单')
    out.push('')
    items.forEach(function (it) {
      var box = it.done ? '[x]' : '[ ]'
      var line = '- ' + box + ' `' + (it.time || '--:--') + '` ' + safe(it.title)
      if (it.tag) line += ' · ' + it.tag
      if (it.duration) line += ' · ' + it.duration + ' 分钟'
      out.push(line)

      var progressText = String(it.progress || '').trim()
      if (progressText) {
        var judged = progressUtil.judge(progressText)
        var tail = (judged.key !== 'none' && judged.label) ? ' → ' + judged.label : ''
        out.push('  - 进度：' + safe(progressText) + tail)
      }
    })
    out.push('')
  }

  /* ---------- 复盘 ---------- */
  if (review && (review.note || (review.lines && review.lines.length))) {
    out.push('## 复盘')
    out.push('')

    if (review.note) {
      out.push(quote(review.note))
      out.push('')
    }

    if (review.lines && review.lines.length) {
      review.lines.forEach(function (l) { out.push('- ' + safe(l)) })
      out.push('')
    }

    if (review.score) {
      out.push('自评：' + review.score + ' / 5')
      out.push('')
    }
  }

  out.push('---')
  out.push('')
  out.push('*由「明日清单」生成 · ' + dateUtil.minutesToHHMM(dateUtil.nowMinutes()) + '*')

  return out.join('\n') + '\n'
}

/** 日记文件名：2026-10-30.md，符合 Obsidian 日记的默认格式 */
function filename(dateStr) {
  return String(dateStr || dateUtil.today()) + '.md'
}

/** 这一天到底有没有内容可写（空日子不生成文件） */
function hasContent(day) {
  day = day || {}
  var items = (day.plan && day.plan.items) ? day.plan.items : []
  var review = day.review
  return items.length > 0 || !!(review && (review.note || (review.lines && review.lines.length)))
}

module.exports = {
  render: render,
  filename: filename,
  hasContent: hasContent
}
