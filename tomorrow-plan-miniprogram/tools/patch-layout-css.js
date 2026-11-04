// 布局重构的样式 + 日历图标定义
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

const CSS = `
/* ================= 布局重构：顶栏压成一行 + 悬浮输入 ================= */

.topbar {
  display: flex;
  align-items: center;
  padding: 4rpx 0 22rpx;
}

.topbar-mascot {
  flex: none;
  width: 96rpx;
  height: 96rpx;
  margin-right: 10rpx;
  display: flex;
  align-items: center;
  transform: scale(0.62);
  transform-origin: 20% 50%;
}

.topbar-main {
  flex: 1;
  min-width: 0;
}

.topbar-date {
  font-size: 38rpx;
  font-weight: 800;
  color: #0a0a0a;
  letter-spacing: -0.5rpx;
  line-height: 1.2;
}

.topbar-stat {
  margin-top: 4rpx;
  font-size: 23rpx;
  color: #9a9a9a;
  font-weight: 600;
}

.empty-hint {
  padding: 60rpx 0 40rpx;
  text-align: center;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 800;
  color: #0a0a0a;
}

.empty-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #9a9a9a;
}

.fab {
  position: fixed;
  left: 50%;
  bottom: 36rpx;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  height: 96rpx;
  padding: 0 44rpx;
  border-radius: 999rpx;
  background: #111111;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 800;
  box-shadow: 0 10rpx 0 #000000, 0 18rpx 30rpx rgba(0, 0, 0, 0.18);
}

.fab:active {
  transform: translateX(-50%) translateY(10rpx);
  box-shadow: 0 0 0 #000000;
}

.fab-plus {
  font-size: 38rpx;
  margin-right: 12rpx;
  line-height: 1;
}

.composer-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.28);
  z-index: 90;
}

.composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  max-height: 86vh;
  overflow-y: auto;
  padding: 28rpx 32rpx 60rpx;
  background: #ffffff;
  border-radius: 28rpx 28rpx 0 0;
  border-top: 4rpx solid #dcdcdc;
  animation: sheetUp 0.24s cubic-bezier(0.2, 0.8, 0.3, 1);
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.composer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18rpx;
}

.composer-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #0a0a0a;
}

.composer-close {
  font-size: 26rpx;
  color: #9a9a9a;
  font-weight: 700;
  padding: 8rpx 4rpx;
}

.composer .btn-primary {
  margin-top: 22rpx;
}

.nudge {
  border: 4rpx solid #ffe0c2;
  border-radius: 10rpx;
  background: #fff8f0;
  padding: 22rpx 24rpx;
  margin-bottom: 18rpx;
}
`

const indexWxss = path.join(root, 'pages/index/index.wxss')
fs.appendFileSync(indexWxss, CSS, 'utf8')
console.log('index.wxss 已加布局样式')

// 日历图标
const iconFile = path.join(root, 'tools/make_icons.py')
let icons = fs.readFileSync(iconFile, 'utf8')
if (!icons.includes('"calendar"')) {
  const cal = `    "calendar": [
        "111111111",
        "101010101",
        "111111111",
        "101010101",
        "111111111",
        "101010101",
        "111111111",
        "101010101",
        "000000000",
    ],
}
`
  icons = icons.replace(/\n\}\n\n\ndef draw\(/, '\n' + cal + '\n\ndef draw(')
  // 兜底：如果上面没匹配，直接在 ICONS 结尾插入
  if (!icons.includes('"calendar"')) {
    const idx = icons.indexOf('}\n\n\ndef draw(')
    if (idx > 0) {
      icons =
        icons.slice(0, idx) + '    "calendar": [\n' +
        '        "111111111",\n        "101010101",\n        "111111111",\n' +
        '        "101010101",\n        "111111111",\n        "101010101",\n' +
        '        "111111111",\n        "101010101",\n        "000000000",\n    ],\n' +
        icons.slice(idx)
    }
  }
  fs.writeFileSync(iconFile, icons, 'utf8')
  console.log('日历图标已定义:', icons.includes('"calendar"'))
} else {
  console.log('日历图标已存在')
}
