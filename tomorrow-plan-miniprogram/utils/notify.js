/**
 * 每晚微信提醒。
 *
 * 用的是「一次性订阅消息」——用户点一次「允许」只能换一条推送，
 * 这是微信的规则，不是实现偷懒。所以流程是：
 *   点按钮 → 授权 → 云端记一条额度 → 当晚 20:00 发一条 → 额度清零
 * 第二天想再收到，得再点一次。
 */

var cloud = require('./cloud.js')

/**
 * 弹授权框，成功后到云端登记一条额度。
 * @return {Promise<{ok:boolean, registered:boolean, left?:number, reason?:string}>}
 */
function askAndRegister() {
  return new Promise(function (resolve) {
    if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
      resolve({ ok: false, registered: false, reason: 'unsupported' })
      return
    }

    var tmplId = cloud.templateId()
    if (!tmplId) {
      resolve({ ok: false, registered: false, reason: 'no-template' })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: function (res) {
        var status = (res && res[tmplId]) || 'reject'
        if (status !== 'accept') {
          resolve({ ok: false, registered: false, reason: status })
          return
        }

        if (!cloud.available()) {
          // 授权成功但没云开发：本地也算成功，只是发不出去
          resolve({ ok: true, registered: false, reason: 'no-cloud' })
          return
        }

        cloud.call('dailyReminder', { status: 'accept' })
          .then(function (r) {
            resolve({
              ok: true,
              registered: !!(r && r.ok),
              left: r && r.left
            })
          })
          .catch(function () {
            resolve({ ok: true, registered: false, reason: 'cloud-fail' })
          })
      },
      fail: function (err) {
        resolve({ ok: false, registered: false, reason: (err && err.errMsg) || 'fail' })
      }
    })
  })
}

module.exports = {
  askAndRegister: askAndRegister,
  hasTemplate: function () { return cloud.hasTemplate() }
}
