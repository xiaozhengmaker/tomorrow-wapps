/**
 * 云开发的最小封装。
 *
 * 没开云开发、没填环境 ID 的时候，所有调用都安静地失败，
 * 本地功能（清单/拆解/复盘）一点都不受影响。
 */

/** ← 填你的云开发环境 ID，比如 'cloud1-9gxxxxxxxxxx'。留空表示用默认环境 */
var ENV = 'cloud1-d2g2zn0bm8988b897'

/** ← 填小程序后台「订阅消息」里申请到的模板 ID。留空则「每晚微信提醒」不可用 */
var SUBSCRIBE_TEMPLATE_ID = ''

var ready = false

function init() {
  if (typeof wx === 'undefined' || !wx.cloud) {
    ready = false
    return false
  }
  try {
    if (ENV) wx.cloud.init({ env: ENV, traceUser: true })
    else wx.cloud.init({ traceUser: true })
    ready = true
  } catch (e) {
    console.error('[cloud] 初始化失败', e)
    ready = false
  }
  return ready
}

function available() {
  return ready && typeof wx !== 'undefined' && !!wx.cloud
}

function call(name, data) {
  if (!available()) {
    return Promise.reject(new Error('云开发未初始化'))
  }
  return wx.cloud.callFunction({ name: name, data: data })
    .then(function (res) { return res && res.result })
}

module.exports = {
  init: init,
  available: available,
  call: call,
  templateId: function () { return SUBSCRIBE_TEMPLATE_ID },
  hasTemplate: function () { return !!SUBSCRIBE_TEMPLATE_ID }
}
