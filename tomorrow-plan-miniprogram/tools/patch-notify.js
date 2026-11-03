// 一次性补丁：让订阅消息在开发者工具里给出清楚的提示
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function patch(rel, pairs) {
  const file = path.join(root, rel)
  let t = fs.readFileSync(file, 'utf8')
  let hit = 0
  for (const [from, to] of pairs) {
    if (t.includes(from)) {
      t = t.split(from).join(to)
      hit++
    } else {
      console.log('  miss ->', rel, '|', from.slice(0, 40))
    }
  }
  fs.writeFileSync(file, t, 'utf8')
  console.log(`  ${rel}: ${hit}/${pairs.length}`)
}

// 1) notify.js：加 isDevtools 并在入口拦一层
patch('utils/notify.js', [
  [
    'function askAndRegister() {',
    `/** 开发者工具里微信不支持订阅消息，提前拦一下，别让人以为是自己配错了 */
function isDevtools() {
  try {
    var info = (typeof wx.getDeviceInfo === 'function')
      ? wx.getDeviceInfo()
      : wx.getSystemInfoSync()
    return !!info && info.platform === 'devtools'
  } catch (e) {
    return false
  }
}

function askAndRegister() {`
  ],
  [
    `    if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
      resolve({ ok: false, registered: false, reason: 'unsupported' })
      return
    }`,
    `    if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
      resolve({ ok: false, registered: false, reason: 'unsupported' })
      return
    }

    if (isDevtools()) {
      resolve({ ok: false, registered: false, reason: 'devtools' })
      return
    }`
  ],
  [
    'module.exports = {\n  askAndRegister: askAndRegister,',
    'module.exports = {\n  askAndRegister: askAndRegister,\n  isDevtools: isDevtools,'
  ]
])

// 2) settings.js：devtools 时弹明确说明
patch('pages/settings/settings.js', [
  [
    `      } else if (res.reason === 'reject') {
        wx.showToast({ title: '你拒绝了，今晚不发', icon: 'none' })
      } else {`,
    `      } else if (res.reason === 'reject') {
        wx.showToast({ title: '你拒绝了，今晚不发', icon: 'none' })
      } else if (res.reason === 'devtools') {
        wx.showModal({
          title: '开发者工具里用不了',
          content: '订阅消息只在真机生效。点工具栏「预览」，用手机扫码，在手机上点「开启今晚的提醒」。',
          showCancel: false,
          confirmText: '知道了'
        })
      } else {`
  ]
])

console.log('done')
