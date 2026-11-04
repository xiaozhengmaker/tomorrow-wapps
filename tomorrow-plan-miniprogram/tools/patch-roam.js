// 吉祥物游荡：在顶部区域随机移动 + 偶尔闪现
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

// ---------- 1) wxml：拆成 外层位移 / 内层动画 / 点阵本体 ----------
const wxmlFile = path.join(root, 'pages/index/index.wxml')
let wxml = fs.readFileSync(wxmlFile, 'utf8')

const oldMascot = `    <view class="topbar-mascot mascot-float {{petting ? 'mascot-pet' : ''}}" bindtap="petMascot">
      <view class="mascot-box"><view class="mascot"></view></view>
    </view>`

const newMascot = `    <view class="mascot-playground">
      <view
        class="topbar-mascot {{blinking ? 'is-blink' : ''}}"
        style="transform: translate({{mx}}rpx, {{my}}rpx)"
        bindtap="petMascot"
      >
        <view class="mascot-inner {{petting ? 'mascot-pet' : ''}}">
          <view class="mascot-box"><view class="mascot"></view></view>
        </view>
      </view>
    </view>`

if (!wxml.includes(oldMascot)) {
  console.log('wxml 锚点没匹配')
  process.exit(1)
}
wxml = wxml.replace(oldMascot, newMascot)
fs.writeFileSync(wxmlFile, wxml, 'utf8')
console.log('index.wxml 已改')

// ---------- 2) js：游荡逻辑 ----------
const jsFile = path.join(root, 'pages/index/index.js')
let js = fs.readFileSync(jsFile, 'utf8')

js = js.replace(
  "    composerOpen: false,",
  "    composerOpen: false,\n    mx: 0,\n    my: 0,\n    blinking: false,"
)

const roam = `  /** 吉祥物在顶部区域游荡：大部分时候飘过去，偶尔闪一下换位置 */
  startRoam: function () {
    var self = this
    if (this._roamTimer) return
    this._roamTimer = setInterval(function () {
      self.roamStep()
    }, 3600)
  },

  stopRoam: function () {
    if (this._roamTimer) {
      clearInterval(this._roamTimer)
      this._roamTimer = null
    }
  },

  roamStep: function () {
    // 可移动范围（rpx）：顶部那条带子，别飘到清单上去
    var MAX_X = 556
    var MAX_Y = 112
    var x = Math.round(Math.random() * MAX_X)
    var y = Math.round(Math.random() * MAX_Y)

    if (Math.random() < 0.35) {
      // 闪现：先淡出，瞬移，再淡入
      var self = this
      this.setData({ blinking: true })
      clearTimeout(this._blinkTimer)
      this._blinkTimer = setTimeout(function () {
        self.setData({ mx: x, my: y, blinking: false })
      }, 170)
    } else {
      this.setData({ mx: x, my: y })
    }
  },

  /** 摸一下吉祥物`

js = js.replace('  /** 摸一下吉祥物', roam)

js = js.replace(
  '    wx.vibrateShort && wx.vibrateShort({ type: \'light\' })',
  `    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.roamStep()`
)

js = js.replace(
  '  onShow: function () {\n',
  '  onShow: function () {\n    this.startRoam()\n'
)

js = js.replace(
  '  onHide: function () {',
  '  onUnload: function () {\n    this.stopRoam()\n  },\n\n  onHide: function () {\n    this.stopRoam()'
)

if (!js.includes('onHide: function () {\n    this.stopRoam()')) {
  js = js.replace('  onShow: function () {', `  onHide: function () {
    this.stopRoam()
  },

  onShow: function () {`)
}

fs.writeFileSync(jsFile, js, 'utf8')
console.log('index.js 已加游荡逻辑:', js.includes('roamStep'))

// ---------- 3) wxss ----------
const cssFile = path.join(root, 'pages/index/index.wxss')
let css = fs.readFileSync(cssFile, 'utf8')

const oldCss = `.topbar-mascot {
  position: absolute;
  left: -8rpx;
  top: -18rpx;
  z-index: 3;
  width: 132rpx;
  height: 152rpx;
  display: flex;
  align-items: flex-start;
  transform: scale(0.62);
  transform-origin: 0 0;
  /* 这一层投影就是「悬浮」的关键：有影子才会觉得它离开了纸面 */
  filter: drop-shadow(0 10rpx 14rpx rgba(255, 107, 26, 0.28))
          drop-shadow(0 3rpx 4rpx rgba(0, 0, 0, 0.16));
}`

const newCss = `/* 顶部一条「游乐场」，火焰在这条带子里飘，不遮挡下面的清单 */
.mascot-playground {
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 300rpx;
  z-index: 3;
  pointer-events: none;
}

.topbar-mascot {
  position: absolute;
  left: 0;
  top: 0;
  width: 132rpx;
  height: 152rpx;
  pointer-events: auto;
  transform-origin: 0 0;
  /* 飘过去要有点回弹感 */
  transition: transform 1.4s cubic-bezier(0.34, 1.4, 0.64, 1);
  filter: drop-shadow(0 10rpx 14rpx rgba(255, 107, 26, 0.28))
          drop-shadow(0 3rpx 4rpx rgba(0, 0, 0, 0.16));
}

/* 闪现：不带动画地瞬移 */
.topbar-mascot.is-blink {
  transition: opacity 0.16s linear;
  opacity: 0;
}

.mascot-inner {
  width: 100%;
  height: 100%;
  transform: scale(0.62);
  transform-origin: 0 0;
}`

if (!css.includes(oldCss)) {
  console.log('wxss 锚点没匹配')
  process.exit(1)
}
css = css.replace(oldCss, newCss)
fs.writeFileSync(cssFile, css, 'utf8')
console.log('index.wxss 已改')
