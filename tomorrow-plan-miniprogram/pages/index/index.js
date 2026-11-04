var parser = require('../../utils/parser.js')
var store = require('../../utils/store.js')
var dateUtil = require('../../utils/date.js')

var SAMPLE = [
  '明天上午九点跟客户开会，大概一小时',
  '下午把周报写完',
  '晚上八点去健身',
  '记得交电费'
].join('\n')

function byTime(a, b) {
  return dateUtil.hhmmToMinutes(a.time) - dateUtil.hhmmToMinutes(b.time)
}

function buildCard(plan, badge) {
  if (!plan) return null
  var items = plan.items.slice().sort(byTime)
  if (!items.length) return null

  var doneCount = 0
  items.forEach(function (it) { if (it.done) doneCount++ })

  return {
    date: plan.date,
    badge: badge,
    weekday: dateUtil.dayLabel(plan.date) + ' ' + dateUtil.weekday(plan.date),
    total: items.length,
    doneCount: doneCount,
    percent: Math.round(doneCount / items.length * 100),
    preview: items.slice(0, 3).map(function (it) {
      return { id: it.id, time: it.time, title: it.title, done: !!it.done }
    })
  }
}

Page({
  data: {
    draft: '',
    canSubmit: false,
    cards: [],
    needReview: false,
    remindTime: '20:00',
    target: '',
    targetLabel: '明天',
    quickDates: [],
    isCustomDate: false,
    composerOpen: false,
    todayLabel: '',
    todayStat: ''
  },

  onShow: function () {
    var draft = store.getDraft()
    var cards = []
    var today = buildCard(store.getPlan(dateUtil.today()), '今日')
    var tomorrow = buildCard(store.getPlan(dateUtil.tomorrow()), '明日')
    if (today) cards.push(today)
    if (tomorrow) cards.push(tomorrow)

    var settings = store.getSettings()
    var needReview = this.checkReview(settings)
    var streak = this.computeStreak()

    // 第一次进来默认排到明天；用户手动选过就一直用他选的
    var target = this.data.target || dateUtil.tomorrow()

    this.setData({
      draft: draft,
      canSubmit: !!String(draft).trim(),
      cards: cards,
      needReview: needReview,
      remindTime: settings.remindTime,
      streak: streak,
      petting: this.data.petting || false,
      target: target,
      targetLabel: dateUtil.friendlyDate(target),
      isCustomDate: target !== dateUtil.today() && target !== dateUtil.tomorrow(),
      quickDates: this.buildQuickDates(),
      todayLabel: dateUtil.friendlyDate(dateUtil.today()),
      todayStat: (cards[0] ? cards[0].doneCount + '/' + cards[0].total + ' 已完成' : '今天还空着')
    })
  },

  /** 今天 / 明天 / 后天 三个快捷日期 */
  buildQuickDates: function () {
    var self = this
    var base = dateUtil.today()
    return [
      { key: 'today', label: '今天', date: base },
      { key: 'tomorrow', label: '明天', date: dateUtil.shift(base, 1) },
      { key: 'dayafter', label: '后天', date: dateUtil.shift(base, 2) }
    ]
  },

  pickDate: function (e) {
    var date = e.currentTarget.dataset.date
    if (!date) return
    this.applyTarget(date)
  },

  onDateChange: function (e) {
    this.applyTarget(e.detail.value)
  },

  applyTarget: function (date) {
    this.setData({
      target: date,
      targetLabel: dateUtil.friendlyDate(date),
      isCustomDate: date !== dateUtil.today() && date !== dateUtil.tomorrow()
    })
  },

  /** 打开 / 收起输入面板 */
  openComposer: function () {
    this.setData({ composerOpen: true })
  },

  closeComposer: function () {
    this.setData({ composerOpen: false })
  },

  /** 摸一下吉祥物：晃一晃 + 冒火星 */
  petMascot: function () {
    var self = this
    if (this.data.petting) return
    this.setData({ petting: true })
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    clearTimeout(this._petTimer)
    this._petTimer = setTimeout(function () {
      self.setData({ petting: false })
    }, 900)
  },

  /** 连续复盘了几天（今天还没复盘就从昨天往前数） */
  computeStreak: function () {
    var day = dateUtil.today()
    if (!store.hasReview(day)) day = dateUtil.shift(day, -1)
    var n = 0
    while (n < 999 && store.hasReview(day)) {
      n++
      day = dateUtil.shift(day, -1)
    }
    return n
  },

  /** 到了设定的提醒时间还没复盘，就在「复盘」tab 上点个小红点 */
  checkReview: function (settings) {
    settings = settings || store.getSettings()
    var pending = !!settings.remindEnabled &&
      dateUtil.nowMinutes() >= dateUtil.hhmmToMinutes(settings.remindTime) &&
      !store.hasReview(dateUtil.today())

    if (pending) {
      wx.setTabBarBadge({ index: 2, text: '1', fail: function () {} })
    } else {
      wx.removeTabBarBadge({ index: 2, fail: function () {} })
    }
    return pending
  },

  goReview: function () {
    wx.switchTab({ url: '/pages/review/review' })
  },

  onHide: function () {
    store.setDraft(this.data.draft)
  },

  onInput: function (e) {
    var value = e.detail.value
    this.setData({ draft: value, canSubmit: !!value.trim() })

    var self = this
    clearTimeout(this._draftTimer)
    this._draftTimer = setTimeout(function () {
      store.setDraft(self.data.draft)
    }, 400)
  },

  fillSample: function () {
    this.setData({ draft: SAMPLE, canSubmit: true })
    store.setDraft(SAMPLE)
  },

  clearInput: function () {
    this.setData({ draft: '', canSubmit: false })
    store.setDraft('')
  },

  gotoPlan: function (e) {
    var date = e.currentTarget.dataset.date
    if (!date) return
    wx.navigateTo({ url: '/pages/plan/plan?date=' + date })
  },

  generate: function () {
    this.setData({ composerOpen: false })
    var text = String(this.data.draft || '').trim()
    if (!text) {
      wx.showToast({ title: '先写点要做的事', icon: 'none' })
      return
    }

    var items = parser.parse(text)
    if (!items.length) {
      wx.showToast({ title: '没看出要做的事，换个写法', icon: 'none' })
      return
    }

    var target = this.data.target || dateUtil.tomorrow()
    var label = dateUtil.friendlyDate(target)
    var existing = store.getPlan(target)
    var self = this

    var finish = function (mode) {
      if (mode === 'replace') {
        store.setPlan(target, items, text)
      } else {
        store.appendItems(target, items, text)
      }
      store.setDraft('')
      self.setData({ draft: '', canSubmit: false })
      wx.showToast({ title: '排好 ' + items.length + ' 项', icon: 'none' })
      setTimeout(function () {
        wx.navigateTo({ url: '/pages/plan/plan?date=' + target })
      }, 400)
    }

    if (existing && existing.items && existing.items.length) {
      wx.showActionSheet({
        itemList: ['追加到' + label + '的清单', '用这次的覆盖' + label],
        success: function (res) {
          finish(res.tapIndex === 1 ? 'replace' : 'append')
        },
        fail: function () {}
      })
    } else {
      finish('replace')
    }
  },

  onShareAppMessage: function () {
    return {
      title: '把要做的事丢进来，我帮你排好时间',
      path: '/pages/index/index'
    }
  }
})
