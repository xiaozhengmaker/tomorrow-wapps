// 部署文档里补上「订阅消息的正确配置」和两条硬限制
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '部署·手把手.md')
let t = fs.readFileSync(file, 'utf8')

const marker = '> 修改环境变量后**不用重新上传代码**，保存就生效。'

const extra = `
### ⚠️ SUBSCRIBE_DATA 到底怎么填（最容易错的一步）

你申请的模板如果是这样：

| 详细内容 | 占位符 |
| --- | --- |
| 事项时间 | \`{{time2.DATA}}\` |
| 事项主题 | \`{{thing1.DATA}}\` |

那么变量名就是 **\`time2\`** 和 **\`thing1\`**（\`.DATA\` 是模板里的写法，**不属于变量名**）。

环境变量 \`SUBSCRIBE_DATA\` 的值，整行粘这个：

\`\`\`json
{"thing1":{"value":"今天还没复盘"},"time2":{"value":"20:00"}}
\`\`\`

规则：**每个字段都是一个 \`{"value":"内容"}\` 对象**。

| 常见错法 | 为什么错 |
| --- | --- |
| \`{"time2.DATA":...}\` | 键不能带 \`.DATA\` |
| \`{"time2":{"20:00"}}\` | 对象必须有键，写成 \`{"value":"20:00"}\` |
| \`{"time2":"20:00"}\` | 值必须是对象，不是字符串 |
| JSON 里有换行 | 环境变量里必须是一行 |

字段类型的限制（超了会报 \`47003\`）：

- \`thing\` 类：**最多 20 个字**
- \`time\` 类：\`HH:mm\` 或 \`yyyy-MM-dd HH:mm\`

### ⚠️ 订阅消息为什么在开发者工具里测不出来

**这是微信的限制，不是配置错了。**

1. \`wx.requestSubscribeMessage\` **只在真机上工作**。模拟器里点「开启今晚的提醒」一定失败。
   → 必须点工具栏「**预览**」，手机扫码，在**手机上**点授权。
2. 定时触发器 \`0 0 20 * * * *\` 是**云端**的，本地编译跑一万遍也不会响。
   → 想立刻验证，去云开发控制台 → 云函数 → \`dailyReminder\` → 「**云端测试**」手动跑。

小程序的「设置」页现在会在开发者工具里直接提示这两点，不用靠猜。

${marker}`

if (!t.includes('SUBSCRIBE_DATA 到底怎么填')) {
  t = t.replace(marker, extra)
  fs.writeFileSync(file, t, 'utf8')
  console.log('文档已补充')
} else {
  console.log('已存在，跳过')
}
