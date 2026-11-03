var breakdown = require('../../utils/breakdown.js')
var store = require('../../utils/store.js')
var dateUtil = require('../../utils/date.js')
var ai = require('../../utils/ai.js')
var cloud = require('../../utils/cloud.js')

Page({
  data: {
    goal: '',
    canSubmit: false,
    card: null,
    totalText: '',
    cards: [],
    aiPending: false,
    target: '',
    targetLabel: '明天',
    quickDates: [],
    isCustomDate: false
  },

  onShow: function () {
    this.loadCards()
    this.initDates()
  },

  initDates: function () {
    var base = dateUtil.today()
    var target = this.data.target || dateUtil.tomorrow()
    this.setData({
      target: target,
      targetLabel: dateUtil.friendlyDate(target),
      isCustomDate: target !== base && target !== dateUtil.shift(base, 1),
      quickDates: [
        { key: 'today', label: '今天', date: base },
        { key: 'tomorrow', label: '明天', date: dateUtil.shift(base, 1) },
        { key: 'dayafter', label: '后天', date: dateUtil.shift(base, 2) }
      ]
    })
  },

  pickDate: function (e) {
    var date = e.currentTarget.dataset.date
    if (date) this.applyTarget(date)
  },

  onDateChange: function (e) {
    this.applyTarget(e.detail.value)
  },

  applyTarget: function (date) {
    var base = dateUtil.today()
    this.setData({
      target: date,
      targetLabel: dateUtil.friendlyDate(date),
      isCustomDate: date !== base && date !== dateUtil.shift(base, 1)
    })
  },

  onHide: function () {
    this.flush()
  },

  loadCards: function () {
    var cards = store.getBreakdowns()
      .filter(function (c) { return !c.pushed })
      .slice(0, 6)
      .map(function (c) {
        return {
          id: c.id,
          goal: c.goal,
          stepCount: (c.steps || []).length,
          totalText: dateUtil.formatDuration(breakdown.totalMinutes(c.steps))
        }
      })
    this.setData({ cards: cards })
  },

  onInput: function (e) {
    var value = e.detail.value
    this.setData({ goal: value, canSubmit: !!value.trim() })
  },

  /* ---------------- 拆 ---------------- */

  generate: function () {
    var goal = String(this.data.goal || '').trim()
    if (!goal) {
      wx.showToast({ title: '先写一句话', icon: 'none' })
      return
    }

    var userTemplate = breakdown.findUserTemplate(goal, store.getUserTemplates())
    var card = breakdown.build(goal, { userTemplate: userTemplate })
    if (!card) return

    store.addBreakdown(card)
    this.showCard(card)
    this.askAI(goal, card.id)

    try { wx.vibrateShort({ type: 'light', fail: function () {} }) } catch (err) {}
  },

  /**
   * 本地模板先把卡片摆出来，AI 回来了再替换。
   * 没配云开发、key 错了、超时，都安静地保持模板版本。
   */
  askAI: function (goal, cardId) {
    var self = this
    if (!cloud.available()) return

    this.setData({ aiPending: true })

    ai.breakdown(goal).then(function (steps) {
      self.setData({ aiPending: false })
      if (!steps || !steps.length) return

      var card = self.data.card
      if (!card || card.id !== cardId) return // 用户已经换了个目标

      var next = JSON.parse(JSON.stringify(card))
      next.steps = steps
      next.templateName = 'AI 拆的'
      next.fromUser = false
      next.byAI = true

      self.persist(next)
      self.showCard(next)
    }).catch(function () {
      self.setData({ aiPending: false })
    })
  },

  showCard: function (card) {
    this.setData({
      card: card,
      totalText: dateUtil.formatDuration(breakdown.totalMinutes(card.steps))
    })
    this.loadCards()
  },

  /* ---------------- 改 ---------------- */

  cloneCard: function () {
    if (!this.data.card) return null
    return JSON.parse(JSON.stringify(this.data.card))
  },

  onStepInput: function (e) {
    var idx = e.currentTarget.dataset.idx
    var card = this.data.card
    if (!card || !card.steps[idx]) return
    card.steps[idx].text = e.detail.value
    this.queueSave(card)
  },

  cycleMinutes: function (e) {
    var idx = e.currentTarget.dataset.idx
    var card = this.data.card
    if (!card || !card.steps[idx]) return

    var pool = breakdown.STEP_MINUTES
    var cur = pool.indexOf(card.steps[idx].minutes)
    var next = pool[(cur + 1) % pool.length]

    card.steps[idx].minutes = next

    var patch = {}
    patch['card.steps[' + idx + '].minutes'] = next
    patch.totalText = dateUtil.formatDuration(breakdown.totalMinutes(card.steps))
    this.setData(patch)
    this.queueSave(card)
  },

  removeStep: function (e) {
    var idx = e.currentTarget.dataset.idx
    var card = this.cloneCard()
    if (!card) return
    if (card.steps.length <= 1) {
      wx.showToast({ title: '至少留一步', icon: 'none' })
      return
    }
    card.steps.splice(idx, 1)
    this.setData({
      card: card,
      totalText: dateUtil.formatDuration(breakdown.totalMinutes(card.steps))
    })
    this.queueSave(card)
  },

  addStep: function () {
    var card = this.cloneCard()
    if (!card) return
    if (card.steps.length >= 3) {
      wx.showToast({ title: '1-2-3 就够了', icon: 'none' })
      return
    }
    card.steps.push({ id: 's' + Date.now().toString(36), text: '', minutes: 15 })
    this.setData({
      card: card,
      totalText: dateUtil.formatDuration(breakdown.totalMinutes(card.steps))
    })
    this.queueSave(card)
  },

  /* ---------------- 存 / 用 ---------------- */

  queueSave: function (card) {
    var self = this
    clearTimeout(this._timer)
    this._timer = setTimeout(function () { self.persist(card) }, 350)
  },

  flush: function () {
    clearTimeout(this._timer)
    if (this.data.card) this.persist(this.data.card)
  },

  persist: function (card) {
    if (!card) return
    store.updateBreakdown(card.id, {
      steps: card.steps,
      pushed: !!card.pushed
    })
  },

  saveAsTemplate: function () {
    var card = this.data.card
    if (!card) return

    var steps = card.steps.map(function (s) {
      return { text: s.text, minutes: s.minutes }
    })
    if (!steps.length) return

    store.saveUserTemplate({
      id: 'u' + Date.now().toString(36),
      templateId: card.templateId,
      name: card.goal,
      steps: steps
    })
    wx.showToast({ title: '已存为我的模板', icon: 'none' })
  },

  switchTemplate: function () {
    var card = this.data.card
    if (!card) return

    var fresh = breakdown.build(card.goal, {})
    fresh.id = card.id
    fresh.createdAt = card.createdAt
    this.persist(fresh)
    this.showCard(fresh)
  },

  /* ---------------- 排进清单 ---------------- */

  pushToPlan: function () {
    var card = this.data.card
    if (!card || !card.steps.length) return

    var empty = card.steps.some(function (s) { return !String(s.text || '').trim() })
    if (empty) {
      wx.showToast({ title: '有一步还是空的', icon: 'none' })
      return
    }

    this.flush()

    var target = this.data.target || dateUtil.tomorrow()
    var label = dateUtil.friendlyDate(target)
    var existing = store.getPlan(target)
    var busy = (existing ? existing.items : []).map(function (it) {
      var start = dateUtil.hhmmToMinutes(it.time)
      return { start: start, end: start + (it.duration || 30) }
    })

    var settings = store.getSettings()
    var startMinutes = dateUtil.hhmmToMinutes(settings.breakdownStart)

    var items = breakdown.toPlanItems(card, { startMinutes: startMinutes, busy: busy })
    store.appendItems(target, items, '拆解：' + card.goal)
    store.updateBreakdown(card.id, { pushed: true })

    this.setData({ card: null, goal: '', canSubmit: false, totalText: '' })
    this.loadCards()

    wx.showToast({ title: '已排进' + label + '，' + items.length + ' 步', icon: 'none' })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/index/index' })
    }, 560)
  },

  /* ---------------- 历史 ---------------- */

  reopen: function (e) {
    var id = e.currentTarget.dataset.id
    var found = null
    store.getBreakdowns().forEach(function (c) {
      if (c.id === id) found = c
    })
    if (found) this.showCard(found)
  },

  discard: function (e) {
    var id = e.currentTarget.dataset.id
    var self = this
    wx.showModal({
      title: '丢掉这张卡片？',
      confirmText: '丢掉',
      confirmColor: '#0b5fd0',
      success: function (res) {
        if (!res.confirm) return
        store.removeBreakdown(id)
        if (self.data.card && self.data.card.id === id) {
          self.setData({ card: null, totalText: '' })
        }
        self.loadCards()
      }
    })
  },

  onShareAppMessage: function () {
    return {
      title: '把模糊的事拆成 1-2-3',
      path: '/pages/breakdown/breakdown'
    }
  }
})
