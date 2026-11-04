// 日历页：台历外形 + 每天的彩色像素火焰表示进度
var store = require('../../utils/store.js')
var dateUtil = require('../../utils/date.js')

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: '',
    summary: '',
    cells: [],
    rings: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    weekLabels: ['一', '二', '三', '四', '五', '六', '日']
  },

  onShow: function () {
    var t = dateUtil.today()
    if (!this.data.year) {
      this.setData({ year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) })
    }
    this.build(this.data.year, this.data.month)
  },

  build: function (year, month) {
    var first = new Date(year, month - 1, 1)
    var startWeek = (first.getDay() + 6) % 7
    var days = new Date(year, month, 0).getDate()
    var todayStr = dateUtil.today()

    var cells = []
    for (var i = 0; i < startWeek; i++) {
      cells.push({ key: 'blank' + i, blank: true })
    }

    var monthDone = 0
    var monthTotal = 0

    for (var d = 1; d <= days; d++) {
      var dateStr = year + '-' + dateUtil.pad(month) + '-' + dateUtil.pad(d)
      var plan = store.getPlan(dateStr) || []
      var total = plan.length
      var done = 0
      for (var k = 0; k < plan.length; k++) {
        if (plan[k].done) done++
      }
      monthDone += done
      monthTotal += total

      var ratio = total ? done / total : 0
      var level = 0
      if (total) level = ratio === 1 ? 4 : ratio >= 0.5 ? 3 : ratio > 0 ? 2 : 1

      var weekday = (startWeek + d - 1) % 7   // 0 = 周一

      cells.push({
        key: dateStr,
        blank: false,
        date: dateStr,
        day: d,
        total: total,
        done: done,
        level: level,
        isToday: dateStr === todayStr,
        isWeekend: weekday >= 5
      })
    }

    var rate = monthTotal ? Math.round((monthDone / monthTotal) * 100) : 0

    this.setData({
      year: year,
      month: month,
      monthLabel: year + ' 年 ' + month + ' 月',
      cells: cells,
      summary: monthTotal ? '本月 ' + monthDone + '/' + monthTotal + ' · ' + rate + '%' : '本月还没有安排'
    })
  },

  prevMonth: function () {
    var y = this.data.year
    var m = this.data.month - 1
    if (m < 1) { m = 12; y -= 1 }
    this.build(y, m)
  },

  nextMonth: function () {
    var y = this.data.year
    var m = this.data.month + 1
    if (m > 12) { m = 1; y += 1 }
    this.build(y, m)
  },

  openDay: function (e) {
    var date = e.currentTarget.dataset.date
    if (!date) return
    wx.navigateTo({ url: '/pages/plan/plan?date=' + date })
  }
})
