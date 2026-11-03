/**
 * 日期与时间的小工具。
 * 不依赖 wx API，纯函数，方便单独测试。
 */

var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function ymd(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function parseYmd(s) {
  var p = String(s || '').split('-')
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
}

function today() {
  return ymd(new Date())
}

function tomorrow() {
  var d = new Date()
  d.setDate(d.getDate() + 1)
  return ymd(d)
}

function shift(dateStr, days) {
  var d = parseYmd(dateStr)
  d.setDate(d.getDate() + days)
  return ymd(d)
}

function weekday(dateStr) {
  return WEEK[parseYmd(dateStr).getDay()]
}

/** 10月30日 */
function dayLabel(dateStr) {
  var d = parseYmd(dateStr)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

/** 今天 / 明天 / 后天 / 昨天 / 10月30日 */
function friendlyDate(dateStr) {
  var t = today()
  if (dateStr === t) return '今天'
  if (dateStr === shift(t, 1)) return '明天'
  if (dateStr === shift(t, 2)) return '后天'
  if (dateStr === shift(t, -1)) return '昨天'
  return dayLabel(dateStr)
}

function minutesToHHMM(m) {
  m = Math.round(m)
  if (m < 0) m = 0
  if (m > 23 * 60 + 59) m = 23 * 60 + 59
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60)
}

function hhmmToMinutes(s) {
  var p = String(s || '0:0').split(':')
  var h = parseInt(p[0], 10)
  var mi = parseInt(p[1], 10)
  if (isNaN(h)) h = 0
  if (isNaN(mi)) mi = 0
  return h * 60 + mi
}

function nowMinutes() {
  var d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** 分钟数 -> 「1 小时 30 分」 */
function formatDuration(min) {
  var m = Math.round(Number(min) || 0)
  if (m <= 0) return ''
  if (m < 60) return m + ' 分钟'
  var h = Math.floor(m / 60)
  var rest = m % 60
  return rest ? h + ' 小时 ' + rest + ' 分' : h + ' 小时'
}

module.exports = {
  WEEK: WEEK,
  pad: pad,
  ymd: ymd,
  parseYmd: parseYmd,
  today: today,
  tomorrow: tomorrow,
  shift: shift,
  weekday: weekday,
  dayLabel: dayLabel,
  friendlyDate: friendlyDate,
  minutesToHHMM: minutesToHHMM,
  hhmmToMinutes: hhmmToMinutes,
  nowMinutes: nowMinutes,
  formatDuration: formatDuration
}
