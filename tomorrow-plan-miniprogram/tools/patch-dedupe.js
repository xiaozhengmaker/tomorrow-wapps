// pushDiary 去重：内容没变就不要重复 commit
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'cloudfunctions/pushDiary/index.js')
let t = fs.readFileSync(file, 'utf8')

const from = `  let sha = null
  if (head.status === 200 && head.body && head.body.sha) {
    sha = head.body.sha
  } else if (head.status !== 404) {`

const to = `  let sha = null
  if (head.status === 200 && head.body && head.body.sha) {
    sha = head.body.sha

    // 内容一模一样就别再提交一次，否则每次点「生成评估」都多一条 commit
    try {
      var existing = Buffer.from(head.body.content || '', 'base64').toString('utf8')
      if (existing && existing === markdown) {
        return { ok: true, path: filePath, unchanged: true }
      }
    } catch (e) {
      // 读不出来就照常提交
    }
  } else if (head.status !== 404) {`

if (t.includes(from)) {
  fs.writeFileSync(file, t.replace(from, to), 'utf8')
  console.log('pushDiary 已加去重')
} else if (t.includes('unchanged: true')) {
  console.log('已经有去重逻辑，跳过')
} else {
  console.log('锚点没匹配，请手动检查')
}
