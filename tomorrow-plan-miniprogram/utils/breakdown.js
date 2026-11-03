/**
 * 拆解：把一句抽象的目标，拆成 1-2-3 个最小可执行单元。
 *
 * 立场（和用户确认过的方案「丙」）：
 *   模板先给一版 → 你随手改 → 存成「我的模板」→ 下次同类目标直接命中。
 *   不联网、不花钱、不需要后端。
 *
 * 一个「最小可执行单元」的标准：一个动作、有明确终点、5–30 分钟内做完。
 */

var STEP_MINUTES = [5, 10, 15, 25, 30]

/* 模板顺序即同分时的优先顺序 */
var TEMPLATES = [
  {
    id: 'writing',
    name: '写点东西',
    tag: '工作',
    keywords: ['写', '整理', '总结', '文档', '周报', '月报', '报告', '方案', '稿', 'PPT', 'ppt', '材料'],
    steps: [
      { text: '列出这件事必须回答的 3 个问题', minutes: 10 },
      { text: '先写最丑的一版，中途不许回头改', minutes: 25 },
      { text: '只改开头和结尾，中间别动', minutes: 10 }
    ]
  },
  {
    id: 'meeting',
    name: '开会 / 准备会',
    tag: '工作',
    keywords: ['开会', '会议', '评审', '复盘', '汇报', '沟通', '对接', '讨论'],
    steps: [
      { text: '写下一句话：这次会必须拿到的 1 个结论', minutes: 5 },
      { text: '把要说的话压成 3 条，写在纸上', minutes: 10 },
      { text: '提前 5 分钟进会，先跟一个人聊两句', minutes: 5 }
    ]
  },
  {
    id: 'interview',
    name: '面试 / 求职',
    tag: '工作',
    keywords: ['面试', '应聘', '简历', '求职', '跳槽'],
    steps: [
      { text: '把 JD 里出现最多的 3 个词抄下来', minutes: 10 },
      { text: '每个词准备一个自己的故事', minutes: 30 },
      { text: '对着空气讲一遍，掐表', minutes: 15 }
    ]
  },
  {
    id: 'learning',
    name: '学 / 搞懂',
    tag: '学习',
    keywords: ['学', '看', '读', '研究', '搞懂', '入门', '教程', '课程', '背', '练'],
    steps: [
      { text: '找出你卡住的那一个点，写出来', minutes: 5 },
      { text: '只查这一个点，别顺着链接跑', minutes: 15 },
      { text: '合上资料，用自己的话写 3 行', minutes: 10 }
    ]
  },
  {
    id: 'decide',
    name: '做决定 / 拿主意',
    tag: '工作',
    keywords: ['决定', '选', '要不要', '纠结', '规划', '计划', '想清楚'],
    steps: [
      { text: '把选项写成两行字', minutes: 5 },
      { text: '给每个选项写一句「最坏后果」', minutes: 10 },
      { text: '选那个最坏后果你能接受的', minutes: 5 }
    ]
  },
  {
    id: 'tidy',
    name: '整理 / 收拾',
    tag: '生活',
    keywords: ['整理', '收拾', '打扫', '清理', '搬家', '收纳', '断舍离'],
    steps: [
      { text: '只清一个平面：桌面或床', minutes: 15 },
      { text: '拿一个袋子，只装「确定不要的」', minutes: 10 },
      { text: '剩下的东西各归 3 个固定位置', minutes: 15 }
    ]
  },
  {
    id: 'contact',
    name: '找人 / 联系',
    tag: '工作',
    keywords: ['打电话', '联系', '约', '回复', '找人', '催', '问一下', '联系他'],
    steps: [
      { text: '写一句话：你要他做什么', minutes: 5 },
      { text: '直接发出去，不润色', minutes: 5 },
      { text: '定一个「没回就再问一次」的时间', minutes: 5 }
    ]
  },
  {
    id: 'body',
    name: '身体 / 运动',
    tag: '健康',
    keywords: ['健身', '跑步', '运动', '锻炼', '体检', '减肥', '早睡', '散步', '体重'],
    steps: [
      { text: '只做两件事：换衣服、穿鞋', minutes: 5 },
      { text: '出门走 10 分钟，走到出汗为止', minutes: 10 },
      { text: '回来拉伸 3 分钟', minutes: 5 }
    ]
  }
]

var DEFAULT_TEMPLATE = {
  id: 'general',
  name: '通用拆法',
  tag: '其他',
  keywords: [],
  steps: [
    { text: '用一句话写下「完成的样子」', minutes: 5 },
    { text: '找出第一步，只做这一步', minutes: 15 },
    { text: '做完写一句：下一步是什么', minutes: 5 }
  ]
}

var idSeq = 0
function makeId() {
  idSeq += 1
  return 's' + Date.now().toString(36) + idSeq.toString(36)
}

/**
 * 选模板：长关键词权重更高，避免「会」把「复盘」压掉
 */
function pickTemplate(goal) {
  var text = String(goal || '')
  var best = null
  var bestScore = 0

  TEMPLATES.forEach(function (tpl) {
    var score = 0
    tpl.keywords.forEach(function (kw) {
      if (text.indexOf(kw) >= 0) score += kw.length >= 2 ? 3 : 1
    })
    if (score > bestScore) {
      bestScore = score
      best = tpl
    }
  })

  return best || DEFAULT_TEMPLATE
}

function toSteps(rawSteps) {
  return (rawSteps || []).slice(0, 3).map(function (s) {
    return {
      id: makeId(),
      text: String(s.text || '').trim(),
      minutes: pickMinutes(s.minutes)
    }
  })
}

function pickMinutes(v) {
  var n = Number(v)
  if (STEP_MINUTES.indexOf(n) >= 0) return n
  return 15
}

function totalMinutes(steps) {
  return (steps || []).reduce(function (sum, s) {
    return sum + (Number(s.minutes) || 0)
  }, 0)
}

/**
 * 拆解入口
 * @param {string} goal 一句抽象的目标
 * @param {object} opts { userTemplate } 命中的「我的模板」
 */
function build(goal, opts) {
  opts = opts || {}
  var text = String(goal || '').trim()
  if (!text) return null

  var tpl = opts.userTemplate || pickTemplate(text)

  return {
    id: makeId(),
    goal: text,
    templateId: tpl.id,
    templateName: tpl.name,
    fromUser: !!opts.userTemplate,
    steps: toSteps(tpl.steps),
    createdAt: Date.now(),
    pushed: false
  }
}

/** 新目标能不能命中「我的模板」（按模板分类） */
function findUserTemplate(goal, userTemplates) {
  var list = userTemplates || []
  if (!list.length) return null
  var tpl = pickTemplate(goal)
  var hit = null
  list.forEach(function (t) {
    if (t.templateId === tpl.id) hit = t
  })
  return hit
}

function templateTag(templateId) {
  var tag = '其他'
  TEMPLATES.forEach(function (t) { if (t.id === templateId) tag = t.tag })
  return tag
}

/**
 * 把卡片上的步骤变成明天清单里的事项
 * @param {object} card 拆解卡
 * @param {object} opts { startMinutes, busy:[{start,end}] 已被占用的时间段 }
 */
function toPlanItems(card, opts) {
  opts = opts || {}
  var start = typeof opts.startMinutes === 'number' ? opts.startMinutes : 9 * 60
  var busy = opts.busy || []
  var tag = templateTag(card.templateId)
  var cursor = start

  return (card.steps || []).map(function (step, idx) {
    var duration = Number(step.minutes) || 15
    var begin = findFree(cursor, duration, busy)
    if (begin === null) begin = Math.min(cursor, 23 * 60 + 30)

    var item = {
      id: 'p' + Date.now().toString(36) + idx,
      title: String(step.text || '').trim(),
      time: toHHMM(begin),
      duration: duration,
      tag: tag,
      important: !!card.goal && idx === 0,
      assigned: true,
      done: false
    }
    cursor = begin + duration + 5
    busy.push({ start: begin, end: begin + duration })
    return item
  })
}

/** 从 cursor 开始，找第一个不和 busy 打架的位置 */
function findFree(cursor, duration, busy) {
  var t = cursor
  var guard = 0
  while (guard < 60 && t + duration <= 23 * 60 + 59) {
    var conflict = null
    for (var i = 0; i < busy.length; i++) {
      var b = busy[i]
      if (t < b.end && b.start < t + duration) { conflict = b; break }
    }
    if (!conflict) return t
    t = conflict.end + 5
    guard++
  }
  return null
}

function toHHMM(m) {
  var h = Math.floor(m / 60)
  var mi = m % 60
  return (h < 10 ? '0' + h : '' + h) + ':' + (mi < 10 ? '0' + mi : '' + mi)
}

module.exports = {
  STEP_MINUTES: STEP_MINUTES,
  TEMPLATES: TEMPLATES,
  DEFAULT_TEMPLATE: DEFAULT_TEMPLATE,
  build: build,
  pickTemplate: pickTemplate,
  findUserTemplate: findUserTemplate,
  templateTag: templateTag,
  toPlanItems: toPlanItems,
  totalMinutes: totalMinutes,
  pickMinutes: pickMinutes,
  toHHMM: toHHMM
}
