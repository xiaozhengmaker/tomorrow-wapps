var store = require('../../utils/store.js')
var notify = require('../../utils/notify.js')

Page({
  data: {
    settings: {
      remindEnabled: true,
      remindTime: '20:00',
      breakdownStart: '09:00'
    },
    hasTemplate: false,
    subscribing: false
  },

  onShow: function () {
    this.setData({
      settings: store.getSettings(),
      hasTemplate: notify.hasTemplate()
    })
  },

  /** 每晚微信提醒：一次授权换一条推送 */
  openNightly: function () {
    var self = this

    if (!this.data.hasTemplate) {
      wx.showModal({
        title: '还没配订阅消息模板',
        content: '去 mp.weixin.qq.com → 订阅消息 → 选用，申请一个「待办提醒」类模板，把模板 ID 填进 utils/cloud.js 的 SUBSCRIBE_TEMPLATE_ID。详见「部署指南」F 节。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    if (this.data.subscribing) return
    this.setData({ subscribing: true })

    notify.askAndRegister().then(function (res) {
      self.setData({ subscribing: false })

      if (res.ok && res.registered) {
        wx.showToast({ title: '记下了，今晚提醒你', icon: 'none' })
      } else if (res.ok) {
        wx.showToast({ title: '授权了，但云端没登记上', icon: 'none' })
      } else if (res.reason === 'reject') {
        wx.showToast({ title: '你拒绝了，今晚不发', icon: 'none' })
      } else if (res.reason === 'devtools') {
        wx.showModal({
          title: '开发者工具里用不了',
          content: '订阅消息只在真机生效。点工具栏「预览」，用手机扫码，在手机上点「开启今晚的提醒」。',
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        wx.showToast({ title: '没开成功，稍后再试', icon: 'none' })
      }
    })
  },

  onToggleRemind: function (e) {
    this.apply({ remindEnabled: !!e.detail.value })
  },

  onRemindTime: function (e) {
    this.apply({ remindTime: e.detail.value })
  },

  onBreakdownStart: function (e) {
    this.apply({ breakdownStart: e.detail.value })
  },

  apply: function (patch) {
    var settings = store.saveSettings(patch)
    this.setData({ settings: settings })
  },

  howToCalendar: function () {
    var time = this.data.settings.remindTime
    wx.showModal({
      title: '让系统日历每天响',
      content:
        '1. 打开网页版 preview.html\n' +
        '2. 把提醒时间调成 ' + time + '\n' +
        '3. 点「每日复盘提醒」下载 .ics\n' +
        '4. 用手机日历打开，加入\n\n' +
        '小程序不能生成文件，这一步只能在网页版做。导入之后就不需要再管它了。',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
