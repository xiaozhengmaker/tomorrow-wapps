// 让小火焰压在文字上方「悬浮」，而不是并排
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'pages/index/index.wxss')
let t = fs.readFileSync(file, 'utf8')

const from = `.topbar {
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
}`

const to = `/* 顶栏：火焰脱离文档流，压在日期文字的左上方 */
.topbar {
  position: relative;
  padding: 18rpx 0 24rpx;
  min-height: 104rpx;
}

.topbar-mascot {
  position: absolute;
  left: -8rpx;
  top: -18rpx;
  z-index: 3;
  width: 110rpx;
  height: 110rpx;
  display: flex;
  align-items: center;
  transform: scale(0.72);
  transform-origin: 0 50%;
  /* 这一层投影就是「悬浮」的关键：有影子才会觉得它离开了纸面 */
  filter: drop-shadow(0 10rpx 14rpx rgba(255, 107, 26, 0.28))
          drop-shadow(0 3rpx 4rpx rgba(0, 0, 0, 0.16));
}

.topbar-main {
  padding-left: 84rpx;
  min-width: 0;
}`

if (t.includes(from)) {
  t = t.replace(from, to)
  fs.writeFileSync(file, t, 'utf8')
  console.log('顶栏已改成悬浮布局')
} else {
  console.log('锚点没匹配')
}
