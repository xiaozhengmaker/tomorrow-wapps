// 首页：去掉游荡，火焰改成打卡等级图
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

// ---------- wxml ----------
const wxmlFile = path.join(root, 'pages/index/index.wxml')
let wxml = fs.readFileSync(wxmlFile, 'utf8')

const start = wxml.indexOf('    <view class="mascot-playground">')
const marker = '    </view>\n  </view>\n\n  <!-- 清单'
const end = wxml.indexOf(marker)

if (start < 0) {
  console.log('找不到 mascot-playground')
  process.exit(1)
}

const block = `<image
        class="topbar-flame {{petting ? 'is-pet' : ''}}"
        src="/images/mascot-l{{tier}}.png"
        mode="aspectFit"
        bindtap="petMascot"
      ></image>
`
wxml = wxml.slice(0, start) + block + wxml.slice(end + '    </view>\n'.length)
fs.writeFileSync(wxmlFile, wxml, 'utf8')
console.log('wxml ok:', wxml.includes('topbar-flame'))

// ---------- js ----------
const jsFile = path.join(root, 'pages/index/index.js')
let js = fs.readFileSync(jsFile, 'utf8')

// 去掉游荡的调用
js = js.replace('  onShow: function () {\n    this.startRoam()\n', '  onShow: function () {\n')
js = js.replace('  onUnload: function () {\n    this.stopRoam()\n  },\n\n', '')
js = js.replace('  onHide: function () {\n    this.stopRoam()\n', '  onHide: function () {\n')
js = js.replace(/\n    this\.roamStep\(\)/, '')

// 删掉游荡的三个方法
const roamStart = js.indexOf('  /** 吉祥物在顶部区域游荡')
const roamEnd = js.indexOf('  /** 摸一下吉祥物')
if (roamStart > 0 && roamEnd > roamStart) {
  js = js.slice(0, roamStart) + js.slice(roamEnd)
}

// data 里去掉 mx/my/blinking，加 tier
js = js.replace('    mx: 0,\n    my: 0,\n    blinking: false,\n', '    tier: 0,\n')

// 计算打卡等级
js = js.replace(
  '      streak: streak,',
  `      streak: streak,
      tier: this.flameTier(streak),`
)

js = js.replace(
  '  /** 连续复盘了几天',
  `  /** 打卡等级：连续天数越多，火焰越贵 */
  flameTier: function (streak) {
    if (!streak || streak <= 0) return 0
    if (streak >= 14) return 4   // 钻石蓝
    if (streak >= 7) return 3    // 金
    if (streak >= 3) return 2    // 银
    return 1                     // 普通
  },

  /** 连续复盘了几天`
)

fs.writeFileSync(jsFile, js, 'utf8')
console.log('js ok:', js.includes('flameTier'), '| 游荡已删:', !js.includes('roamStep'))

// ---------- wxss ----------
const cssFile = path.join(root, 'pages/index/index.wxss')
let css = fs.readFileSync(cssFile, 'utf8')

const cssStart = css.indexOf('/* 顶部一条「游乐场」')
const cssEnd = css.indexOf('.mascot-inner {')
const afterInner = css.indexOf('}', cssEnd) + 1

const newCss = `/* 打卡火焰：按连续天数换颜色，不再游荡 */
.topbar {
  position: relative;
}

.topbar-flame {
  position: absolute;
  left: -4rpx;
  top: -6rpx;
  z-index: 3;
  width: 92rpx;
  height: 74rpx;
  image-rendering: pixelated;
  transform-origin: 50% 100%;
  animation: flameBreath 2.6s ease-in-out infinite;
  filter: drop-shadow(0 8rpx 10rpx rgba(255, 107, 26, 0.30));
}

@keyframes flameBreath {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.05) translateY(-4rpx); }
}

.topbar-flame.is-pet {
  animation: petWiggle 0.22s ease-in-out 4;
}`

css = css.slice(0, cssStart) + newCss + css.slice(afterInner)
fs.writeFileSync(cssFile, css, 'utf8')
console.log('wxss ok:', css.includes('topbar-flame'))
