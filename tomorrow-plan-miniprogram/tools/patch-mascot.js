// 把 app.wxss 里的像素吉祥物换成「黑色火焰 + 白眼睛」
const fs = require('fs')
const path = require('path')

const FLAME = [
  '........#.......',
  '.......##.......',
  '.......###......',
  '......####......',
  '......#####.....',
  '.....#######....',
  '.....##o##o#....',
  '....########....',
  '...##########...',
  '..############..',
  '..############..',
  '.##############.',
  '.#############..',
  '..##.###.##.....',
  '..#...#..#......',
  '................'
]

const PX = 10                   // 每个像素 10rpx
const COLORS = { '#': '#0a0a0a', o: '#ffffff' }

const shadows = []
FLAME.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) {
    const c = COLORS[row[x]]
    if (!c) continue
    shadows.push(`${x * PX}rpx ${y * PX}rpx 0 0 ${c}`)
  }
})

const block = `.mascot {
  width: ${PX}rpx;
  height: ${PX}rpx;
  background: transparent;
  box-shadow:
  ${shadows.join(',\n  ')};
}`

const file = path.join(__dirname, '..', 'app.wxss')
let t = fs.readFileSync(file, 'utf8')

const re = /\.mascot \{[\s\S]*?\n\}/
if (!re.test(t)) {
  console.log('没找到 .mascot 块')
  process.exit(1)
}

t = t.replace(re, block)

// 盒子尺寸跟着点阵走
t = t.replace(
  /\.mascot-box \{[\s\S]*?\n\}/,
  `.mascot-box {
  width: ${16 * PX}rpx;
  height: ${15 * PX}rpx;
  position: relative;
  margin: 0 auto;
}`
)

fs.writeFileSync(file, t, 'utf8')
console.log(`吉祥物已换成黑色火焰，${shadows.length} 个像素`)
