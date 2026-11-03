var store = require('../../utils/store.js')
var dateUtil = require('../../utils/date.js')
var progressUtil = require('../../utils/progress.js')

var TAGS = ['工作', '生活', '健康', '学习', '其他']
var PROGRESS_WORDS = ['还没动', '刚开始', '做了一半', '快好了', '卡住了', '做完了']
var TAG_KEY = {
  '工作': 'work',
  '生活': 'life',
  '健康': 'health',
  '学习': 'study',
  '其他': 'misc'
}

function tagKey(tag) {
  return TAG_KEY[tag] || 'misc'
}

Page({
  data: {
    date: '',
    friendly: '',
    weekday: '',
    items: [],
    total: 0,
    doneCount: 0,
    remaining: 0,
    percent: 0,
    headTitle: '',
    isEmpty: true,
    editing: false,
    edit: null,
    tags: TAGS,
    progressWords: PROGRESS_WORDS,
    cheering: false,
    blocks: []
  },

  onLoad: function (query) {
    var date = (query && query.date) ? query.date : dateUtil.today()
    this.setData({ date: date })
    this.refresh()
  },

  onShow: function () {
    this.refresh()
  },

  refresh: function () {
    var date = this.data.date
    if (!date) return

    var plan = store.getPlan(date)
    var raw = (plan && plan.items ? plan.items : []).slice()
    raw.sort(function (a, b) {
      return dateUtil.hhmmToMinutes(a.time) - dateUtil.hhmmToMinutes(b.time)
    })

    var isToday = date === dateUtil.today()
    var nowMin = dateUtil.nowMinutes()
    var doneCount = 0

    var items = raw.map(function (it) {
      if (it.done) doneCount++
      var late = isToday && !it.done && dateUtil.hhmmToMinutes(it.time) < nowMin

      var progressText = String(it.progress || '').trim()
      var judgment = progressUtil.judge(progressText)

      return {
        id: it.id,
        title: it.title,
        time: it.time,
        duration: it.duration,
        durationText: dateUtil.formatDuration(it.duration),
        tag: it.tag || '其他',
        tagKey: tagKey(it.tag),
        done: !!it.done,
        important: !!it.important,
        assigned: !!it.assigned,
        late: late,
        progress: progressText,
        tagChar: String(it.tag || '其他').charAt(0),
        statusKey: judgment.key,
        statusLabel: it.done ? '' : judgment.label
      }
    })

    var total = items.length
    var remaining = total - doneCount
    var percent = total ? Math.round(doneCount / total * 100) : 0
    var headTitle
    if (!total) headTitle = '还没有安排'
    else if (!remaining) headTitle = '全部完成，收工'
    else headTitle = '还有 ' + remaining + ' 件事'

    var friendly = dateUtil.friendlyDate(date)

    this.setData({
      items: items,
      total: total,
      doneCount: doneCount,
      remaining: remaining,
      percent: percent,
      headTitle: headTitle,
      isEmpty: total === 0,
      friendly: friendly,
      weekday: dateUtil.weekday(date)
    })

    wx.setNavigationBarTitle({ title: friendly + '的清单' })
  },

  /* ---------------- 打卡 ---------------- */

  toggle: function (e) {
    var id = e.currentTarget.dataset.id
    var before = this.data.remaining
    store.toggleItem(this.data.date, id)
    this.refresh()

    try {
      wx.vibrateShort({ type: 'light', fail: function () {} })
    } catch (err) {}

    if (before > 0 && this.data.remaining === 0) {
      this.celebrate()
    }
  },

  /** 全部完成：像素瀑布 + 火焰扫屏 */
  celebrate: function () {
    var colors = ['#1cb0f6', '#58cc02', '#ffc800', '#ce82ff', '#ff4b4b']
    var blocks = []
    for (var i = 0; i < 30; i++) {
      blocks.push({
        id: i,
        left: Math.floor(Math.random() * 96),
        delay: (Math.random() * 0.7).toFixed(2),
        dur: (0.9 + Math.random() * 0.8).toFixed(2),
        size: [12, 16, 20, 24][i % 4],
        color: colors[i % colors.length]
      })
    }
    this.setData({ cheering: true, blocks: blocks })
    var self = this
    clearTimeout(this._cheerTimer)
    this._cheerTimer = setTimeout(function () {
      self.setData({ cheering: false })
    }, 2800)
  },

  markAll: function () {
    var self = this
    wx.showModal({
      title: '全部标记为完成？',
      confirmText: '好的',
      success: function (res) {
        if (!res.confirm) return
        store.markAll(self.data.date, true)
        self.refresh()
      }
    })
  },

  /* ---------------- 编辑 ---------------- */

  openEdit: function (e) {
    var id = e.currentTarget.dataset.id
    var plan = store.getPlan(this.data.date)
    if (!plan) return

    var found = null
    plan.items.forEach(function (it) {
      if (it.id === id) found = it
    })
    if (!found) return

    this.setData({
      editing: true,
      edit: {
        id: found.id,
        title: found.title,
        time: found.time,
        tag: found.tag || '其他',
        progress: found.progress || ''
      }
    })
  },

  closeEdit: function () {
    this.setData({ editing: false, edit: null })
  },

  onEditTitle: function (e) {
    this.setData({ 'edit.title': e.detail.value })
  },

  onEditTime: function (e) {
    this.setData({ 'edit.time': e.detail.value })
  },

  onEditTag: function (e) {
    this.setData({ 'edit.tag': e.currentTarget.dataset.tag })
  },

  onEditProgress: function (e) {
    this.setData({ 'edit.progress': e.detail.value })
  },

  /** 点快捷词直接填进去，再点同一个就清空 */
  pickProgress: function (e) {
    var word = e.currentTarget.dataset.w
    var current = this.data.edit ? this.data.edit.progress : ''
    this.setData({ 'edit.progress': current === word ? '' : word })
  },

  saveEdit: function () {
    var edit = this.data.edit
    if (!edit) return

    var title = String(edit.title || '').trim()
    if (!title) {
      wx.showToast({ title: '总得写点什么', icon: 'none' })
      return
    }

    store.updateItem(this.data.date, edit.id, {
      title: title,
      time: edit.time,
      tag: edit.tag,
      progress: edit.progress || ''
    })
    this.closeEdit()
    this.refresh()
  },

  onDelete: function () {
    var self = this
    var edit = this.data.edit
    if (!edit) return

    wx.showModal({
      title: '删掉这一项？',
      content: edit.title,
      confirmText: '删除',
      confirmColor: '#0060df',
      success: function (res) {
        if (!res.confirm) return
        store.removeItem(self.data.date, edit.id)
        self.closeEdit()
        self.refresh()
      }
    })
  },

  /* ---------------- 其他动作 ---------------- */

  clearDay: function () {
    var self = this
    wx.showModal({
      title: '清空这一天的清单？',
      content: '清空后可以回首页重新生成。',
      confirmText: '清空',
      confirmColor: '#0060df',
      success: function (res) {
        if (!res.confirm) return
        store.clearPlan(self.data.date)
        self.refresh()
      }
    })
  },

  goAdd: function () {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      // 首页现在是 tab 页，只能用 switchTab 回去
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onShareAppMessage: function () {
    return {
      title: this.data.friendly + '的清单',
      path: '/pages/plan/plan?date=' + this.data.date
    }
  }
})
