/**
 * 生成 .ics 日历文件内容（RFC 5545 的最小可用集）。
 *
 * 为什么单独抽出来：这是「电脑不开也能提醒」的落点——
 * 导出后交给手机自带日历，响铃的就是系统日历，跟小程序开不开没关系。
 *
 * 不依赖 wx，也不依赖 node 内置模块；日期工具由调用方传入，
 * 所以浏览器预览页和小程序可以共用同一份。
 */

function esc(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function stampNow() {
  var d = new Date()
  return '' + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) +
    'T' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z'
}

/**
 * @param {Array}  items    事项数组，需要有 time / title / duration / tag
 * @param {string} dateStr  'YYYY-MM-DD'
 * @param {object} D        utils/date.js
 * @param {object} opts     { alarmMinutes, calendarName, uidPrefix }
 * @return {string}         带 CRLF 的 .ics 文本
 */
function build(items, dateStr, D, opts) {
  opts = opts || {}
  var alarm = typeof opts.alarmMinutes === 'number' ? opts.alarmMinutes : 10
  var day = String(dateStr).replace(/-/g, '')
  var stamp = stampNow()
  var uidPrefix = opts.uidPrefix || 'tp'

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TomorrowPlan//Tomorrow List//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc(opts.calendarName || '明日清单')
  ]

  ;(items || []).forEach(function (it, idx) {
    var start = D.hhmmToMinutes(it.time)
    var end = Math.min(start + (it.duration || 30), 23 * 60 + 59)
    var desc = (it.tag || '其他') + (it.important ? ' · 重要' : '')

    lines.push('BEGIN:VEVENT')
    // UID 可复现：同一天同一位置重复导出会「更新」而不是堆出重复事件
    lines.push('UID:' + uidPrefix + '-' + day + '-' + idx + '@tomorrow-plan')
    lines.push('DTSTAMP:' + stamp)
    // 不写 Z 也不写 TZID，即「浮动时间」，由手机按本地时区解释
    lines.push('DTSTART:' + day + 'T' + String(it.time).replace(':', '') + '00')
    lines.push('DTEND:' + day + 'T' + D.minutesToHHMM(end).replace(':', '') + '00')
    lines.push('SUMMARY:' + esc(it.title))
    lines.push('DESCRIPTION:' + esc(desc))

    if (alarm > 0) {
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT' + alarm + 'M')
      lines.push('ACTION:DISPLAY')
      lines.push('DESCRIPTION:' + esc(it.title))
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/**
 * 每天固定时间提醒一次（无结束日期）。
 * 用在「每天 20:00 提醒我复盘」这种上——一次导入，长期有效。
 *
 * @param {string} hhmm    '20:00'
 * @param {string} title   '写今日复盘'
 * @param {object} D       utils/date.js
 */
function buildDaily(hhmm, title, D, opts) {
  opts = opts || {}
  var start = D && D.today ? D.today() : '2026-01-01'
  var day = String(start).replace(/-/g, '')
  var clock = String(hhmm || '20:00').replace(':', '')
  var name = title || '写今日复盘'

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TomorrowPlan//Daily Reminder//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:每日复盘',
    'BEGIN:VEVENT',
    'UID:daily-' + clock + '@tomorrow-plan',
    'DTSTAMP:' + stampNow(),
    'DTSTART:' + day + 'T' + clock + '00',
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:' + esc(name),
    opts.description ? 'DESCRIPTION:' + esc(opts.description) : 'DESCRIPTION:' + esc('打开明日清单，写两句'),
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + esc(name),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]

  return lines.join('\r\n') + '\r\n'
}

module.exports = {
  build: build,
  buildDaily: buildDaily,
  esc: esc
}
