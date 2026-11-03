var review = require('../../utils/review.js')
var store = require('../../utils/store.js')
var dateUtil = require('../../utils/date.js')
var diary = require('../../utils/diary.js')
var cloud = require('../../utils/cloud.js')

var STARS = [1, 2, 3, 4, 5]

Page({
  data: {
    date: '',
    friendly: '',
    weekday: '',
    total: 0,
    doneCount: 0,
    rate: 0,
    percent: 0,
    note: '',
    score: 0,
    stars: STARS,
    result: null,
    saved: false,
    history: [],
    trend: [],
    trendHas: false,
    trendAvg: 0
  },

  onShow: function () {
    this.load()
  },

  load: function () {
    var date = dateUtil.today()
    var plan = store.getPlan(date)
    var items = plan ? plan.items : []

    var doneCount = 0
    items.forEach(function (it) { if (it.done) doneCount++ })

    var total = items.length
    var rate = total ? Math.round(doneCount / total * 100) : 0
    var saved = store.getReview(date)

    this.setData({
      date: date,
      friendly: dateUtil.friendlyDate(date),
      weekday: dateUtil.weekday(date),
      total: total,
      doneCount: doneCount,
      rate: rate,
      percent: rate,
      note: saved ? saved.note : this.data.note,
      score: saved ? (saved.score || 0) : this.data.score,
      result: saved ? { lines: saved.lines || [] } : this.data.result,
      saved: !!saved
    })

    this.loadHistory()
    this.loadTrend()
    this.clearBadge()
  },

  /** 最近 7 天的完成率，没复盘的那天留空柱 */
  loadTrend: function () {
    var byDate = {}
    store.listReviews(45).forEach(function (r) { byDate[r.date] = r })

    var trend = []
    var sum = 0
    var days = 0

    for (var i = 6; i >= 0; i--) {
      var d = dateUtil.shift(dateUtil.today(), -i)
      var r = byDate[d]
      var rate = r && typeof r.rate === 'number' ? r.rate : 0

      if (r) {
        sum += rate
        days++
      }

      trend.push({
        date: d,
        label: i === 0 ? '今' : dateUtil.weekday(d).replace('周', ''),
        rate: rate,
        has: !!r,
        height: r ? Math.max(8, Math.round(rate * 1.2)) : 4
      })
    }

    this.setData({
      trend: trend,
      trendHas: days > 0,
      trendAvg: days ? Math.round(sum / days) : 0
    })
  },

  loadHistory: function () {
    var history = store.listReviews(7).map(function (r) {
      return {
        date: r.date,
        label: dateUtil.friendlyDate(r.date),
        rate: typeof r.rate === 'number' ? r.rate : 0,
        score: r.score || 0,
        excerpt: review.excerpt(r)
      }
    })
    this.setData({ history: history })
  },

  onInput: function (e) {
    this.setData({ note: e.detail.value })
  },

  onScore: function (e) {
    var value = Number(e.currentTarget.dataset.v) || 0
    this.setData({ score: this.data.score === value ? 0 : value })
  },

  generate: function () {
    var note = String(this.data.note || '').trim()

    if (!note && !this.data.total) {
      wx.showToast({ title: '写两句，或先去排个清单', icon: 'none' })
      return
    }

    var plan = store.getPlan(this.data.date)
    var res = review.analyze({
      plan: plan,
      note: note,
      score: this.data.score,
      date: this.data.date
    })

    store.saveReview({
      date: this.data.date,
      note: note,
      score: this.data.score,
      lines: res.lines,
      rate: res.rate,
      total: res.total,
      doneCount: res.doneCount,
      createdAt: Date.now()
    })

    this.setData({ result: { lines: res.lines }, saved: true })
    this.loadHistory()
    this.clearBadge()
    this.autoSync()

    try { wx.vibrateShort({ type: 'medium', fail: function () {} }) } catch (err) {}
  },

  /**
   * 生成评估后静默推一次。
   * 失败不打扰——云函数会把没推成功的记进 outbox，每天 23:40 的定时器兜底。
   */
  autoSync: function () {
    if (!cloud.available()) return

    var day = {
      date: this.data.date,
      plan: store.getPlan(this.data.date),
      review: store.getReview(this.data.date)
    }
    if (!diary.hasContent(day)) return

    cloud.call('pushDiary', { date: day.date, markdown: diary.render(day) })
      .catch(function () { /* 静默，等定时器 */ })
  },

  /* 复盘完就把「复盘」tab 上的小点去掉 */
  clearBadge: function () {
    var self = this
    if (!store.hasReview(this.data.date)) return
    wx.removeTabBarBadge({
      index: 2,
      fail: function () {}
    })
  },

  goPlan: function () {
    wx.navigateTo({ url: '/pages/plan/plan?date=' + this.data.date })
  },

  goSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  /**
   * 把今天的日记推到 GitHub 仓库。
   * md 在这里渲染（复用 utils/diary.js），云函数只负责写文件。
   */
  pushDiary: function () {
    var day = {
      date: this.data.date,
      plan: store.getPlan(this.data.date),
      review: store.getReview(this.data.date)
    }

    if (!diary.hasContent(day)) {
      wx.showToast({ title: '今天还没有内容', icon: 'none' })
      return Promise.resolve(null)
    }

    if (!cloud.available()) {
      wx.showModal({
        title: '云开发还没开通',
        content: '按「部署指南」第 D 节开一下云开发，再把环境 ID 填进 utils/cloud.js。本地功能不受影响。',
        showCancel: false,
        confirmText: '知道了'
      })
      return Promise.resolve(null)
    }

    var markdown = diary.render(day)
    wx.showLoading({ title: '同步中', mask: true })

    return cloud.call('pushDiary', { date: day.date, markdown: markdown })
      .then(function (res) {
        wx.hideLoading()
        if (!res || !res.ok) {
          wx.showModal({
            title: '同步失败',
            content: (res && res.error) || '未知错误',
            showCancel: false
          })
          return res
        }
        wx.showToast({ title: '已同步到仓库', icon: 'none' })
        return res
      })
      .catch(function (err) {
        wx.hideLoading()
        wx.showModal({
          title: '同步失败',
          content: String((err && err.message) || err),
          showCancel: false
        })
        return null
      })
  },

  onShareAppMessage: function () {
    return {
      title: this.data.friendly + '推进到哪了',
      path: '/pages/review/review'
    }
  }
})
