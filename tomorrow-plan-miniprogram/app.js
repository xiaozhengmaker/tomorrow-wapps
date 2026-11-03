var store = require('./utils/store.js')
var cloud = require('./utils/cloud.js')

App({
  onLaunch: function () {
    store.bootstrap()
    // 没配云开发也不会炸，只是「同步日记」那个按钮会提示去开通
    cloud.init()
  },

  onError: function (err) {
    console.error('[明日清单] 出错了：', err)
  }
})
