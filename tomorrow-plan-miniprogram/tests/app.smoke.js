/**
 * 冒烟测试：用假的 wx / Page 环境，把两个页面的主流程真跑一遍。
 *   node tests/app.smoke.js
 */

var assert = require('assert')
var startedAt = new Date()

/* ---------------- 假 wx ---------------- */

var mem = {}
var log = { toast: [], modal: [], sheet: [], nav: [], badge: [], cloud: [] }
var behavior = { confirm: true, tapIndex: 0 }

global.wx = {
  getStorageSync: function (k) {
    return mem[k] === undefined ? '' : JSON.parse(JSON.stringify(mem[k]))
  },
  setStorageSync: function (k, v) {
    mem[k] = JSON.parse(JSON.stringify(v))
  },
  showToast: function (o) { log.toast.push(o.title) },
  showModal: function (o) {
    log.modal.push(o.title)
    if (o.success) o.success({ confirm: behavior.confirm, cancel: !behavior.confirm })
  },
  showActionSheet: function (o) {
    log.sheet.push(o.itemList)
    if (o.success) o.success({ tapIndex: behavior.tapIndex })
  },
  navigateTo: function (o) { log.nav.push(o.url) },
  redirectTo: function (o) { log.nav.push(o.url) },
  navigateBack: function () { log.nav.push('back') },
  switchTab: function (o) { log.nav.push(o.url) },
  setTabBarBadge: function (o) { log.badge.push(o.text) },
  removeTabBarBadge: function (o) { log.badge.push(null) },
  setNavigationBarTitle: function () {},
  vibrateShort: function (o) { if (o && o.fail) {} },
  showLoading: function () {},
  hideLoading: function () {},
  cloud: {
    init: function () { log.cloud.init = (log.cloud.init || 0) + 1 },
    callFunction: function (o) {
      log.cloud.push({ name: o.name, data: o.data })
      return Promise.resolve({
        result: behavior.cloudResult || { ok: true, path: 'Daily/' + (o.data && o.data.date) + '.md', commit: 'abc1234' }
      })
    }
  }
}

global.getCurrentPages = function () { return [{}, {}] }

/* ---------------- 假 Page ---------------- */

var lastConfig = null
global.Page = function (cfg) { lastConfig = cfg }

function setByPath(obj, path, value) {
  var parts = String(path).split('.')
  var cur = obj
  for (var i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function makePage(cfg) {
  var page = {}
  Object.keys(cfg).forEach(function (k) { page[k] = cfg[k] })
  page.data = JSON.parse(JSON.stringify(cfg.data || {}))
  page.setData = function (patch) {
    var self = this
    Object.keys(patch).forEach(function (path) { setByPath(self.data, path, patch[path]) })
  }
  return page
}

function loadPage(relPath) {
  lastConfig = null
  delete require.cache[require.resolve(relPath)]
  require(relPath)
  if (!lastConfig) throw new Error('页面没有调用 Page(): ' + relPath)
  return makePage(lastConfig)
}

function byId(page, id) {
  var hit = null
  page.data.items.forEach(function (it) {
    if (it.id === id) hit = it
  })
  return hit
}

var dateUtil = require('../utils/date.js')
var store = require('../utils/store.js')

// 真机上 app.js 的 onLaunch 会做这件事，测试里手动来一下
require('../utils/cloud.js').init()

var passed = 0
function ok(name, fn) {
  fn()
  passed++
  console.log('  ok   ' + name)
}

var TODAY = dateUtil.today()
var TOMORROW = dateUtil.tomorrow()

console.log('\n[1] 首页：进来是空的')

var index = loadPage('../pages/index/index.js')
ok('onShow 不报错', function () { index.onShow() })
ok('没有草稿', function () { assert.strictEqual(index.data.canSubmit, false) })
ok('没有清单卡片', function () { assert.strictEqual(index.data.cards.length, 0) })

console.log('\n[2] 首页：填入示例并生成')

ok('fillSample', function () {
  index.fillSample()
  assert.strictEqual(index.data.canSubmit, true)
  assert.ok(index.data.draft.indexOf('跟客户开会') > 0)
})

ok('generate 生成明天的清单', function () {
  index.generate()
  var plan = store.getPlan(TOMORROW)
  assert.ok(plan, '应当写入明天')
  assert.strictEqual(plan.items.length, 4)
  assert.deepStrictEqual(
    plan.items.map(function (i) { return i.time }),
    ['09:00', '10:30', '14:30', '20:00']
  )
})

ok('生成后输入框清空', function () {
  assert.strictEqual(index.data.draft, '')
  assert.strictEqual(store.getDraft(), '')
})

ok('首页出现「明日」卡片', function () {
  index.onShow()
  assert.strictEqual(index.data.cards.length, 1)
  assert.strictEqual(index.data.cards[0].badge, '明日')
  assert.strictEqual(index.data.cards[0].total, 4)
  assert.strictEqual(index.data.cards[0].preview.length, 3)
})

ok('默认排到明天', function () {
  index.onShow()
  assert.strictEqual(index.data.target, TOMORROW)
  assert.strictEqual(index.data.targetLabel, '明天')
  assert.strictEqual(index.data.quickDates.length, 3)
})

ok('可以改到后天', function () {
  var dayAfter = dateUtil.shift(TODAY, 2)
  index.pickDate({ currentTarget: { dataset: { date: dayAfter } } })
  assert.strictEqual(index.data.target, dayAfter)
  assert.strictEqual(index.data.targetLabel, '后天')
})

ok('生成会落到选中的那天，而不是写死明天', function () {
  var dayAfter = dateUtil.shift(TODAY, 2)
  index.setData({ draft: '下午三点 面试', canSubmit: true })
  index.generate()
  var plan = store.getPlan(dayAfter)
  assert.ok(plan, '后天应该有清单')
  assert.strictEqual(plan.items.length, 1)
  assert.strictEqual(plan.items[0].time, '15:00')
})

ok('切回明天，后面的用例继续用明天', function () {
  index.pickDate({ currentTarget: { dataset: { date: TOMORROW } } })
  assert.strictEqual(index.data.targetLabel, '明天')
})
console.log('\n[3] 清单页：展示与打卡')

var plan = loadPage('../pages/plan/plan.js')
ok('onLoad + onShow', function () {
  plan.onLoad({ date: TOMORROW })
  plan.onShow()
  assert.strictEqual(plan.data.total, 4)
  assert.strictEqual(plan.data.isEmpty, false)
  assert.strictEqual(plan.data.friendly, '明天')
  assert.strictEqual(plan.data.headTitle, '还有 4 件事')
  assert.strictEqual(plan.data.percent, 0)
})

ok('点第一项打勾', function () {
  var id = plan.data.items[0].id
  plan.toggle({ currentTarget: { dataset: { id: id } } })
  assert.strictEqual(plan.data.doneCount, 1)
  assert.strictEqual(plan.data.remaining, 3)
  assert.strictEqual(plan.data.percent, 25)
  assert.strictEqual(plan.data.items[0].done, true)
})

ok('再点一下取消', function () {
  var id = plan.data.items[0].id
  plan.toggle({ currentTarget: { dataset: { id: id } } })
  assert.strictEqual(plan.data.doneCount, 0)
})

ok('写进度 -> 判定出状态', function () {
  var id = plan.data.items[0].id

  plan.openEdit({ currentTarget: { dataset: { id: id } } })
  plan.pickProgress({ currentTarget: { dataset: { w: '做了一半' } } })
  assert.strictEqual(plan.data.edit.progress, '做了一半')

  plan.saveEdit()

  var it = byId(plan, id)
  assert.strictEqual(it.progress, '做了一半')
  assert.strictEqual(it.statusKey, 'half')
  assert.strictEqual(it.statusLabel, '进行中')
})

ok('「卡在等数据」判成卡住，而不是进行中', function () {
  var id = plan.data.items[0].id

  plan.openEdit({ currentTarget: { dataset: { id: id } } })
  plan.onEditProgress({ detail: { value: '做了一半，卡在等数据' } })
  plan.saveEdit()

  var it = byId(plan, id)
  assert.strictEqual(it.statusKey, 'blocked')
  assert.strictEqual(it.statusLabel, '卡住了')
})

ok('再点同一个快捷词会清空', function () {
  var id = plan.data.items[0].id

  plan.openEdit({ currentTarget: { dataset: { id: id } } })
  assert.strictEqual(plan.data.edit.progress, '做了一半，卡在等数据', '打开时应该带回已存的进度')

  plan.pickProgress({ currentTarget: { dataset: { w: '快好了' } } })
  assert.strictEqual(plan.data.edit.progress, '快好了')

  plan.pickProgress({ currentTarget: { dataset: { w: '快好了' } } })
  assert.strictEqual(plan.data.edit.progress, '')
  plan.closeEdit()
})

ok('打勾之后不再显示状态标（勾就是完成）', function () {
  var id = plan.data.items[0].id
  plan.toggle({ currentTarget: { dataset: { id: id } } })
  assert.strictEqual(byId(plan, id).statusLabel, '')
  plan.toggle({ currentTarget: { dataset: { id: id } } })
})

ok('全部完成', function () {
  plan.markAll()
  assert.strictEqual(plan.data.remaining, 0)
  assert.strictEqual(plan.data.headTitle, '全部完成，收工')
  assert.strictEqual(plan.data.percent, 100)
})

ok('重新打勾没有崩', function () {
  var id = plan.data.items[1].id
  plan.toggle({ currentTarget: { dataset: { id: id } } })
  assert.strictEqual(plan.data.remaining, 1)
})

console.log('\n[4] 清单页：编辑')

ok('打开编辑面板', function () {
  var target = plan.data.items[2]
  plan.openEdit({ currentTarget: { dataset: { id: target.id } } })
  assert.strictEqual(plan.data.editing, true)
  assert.strictEqual(plan.data.edit.id, target.id)
})

ok('改标题和分类', function () {
  plan.onEditTitle({ detail: { value: '去健身房练腿' } })
  plan.onEditTag({ currentTarget: { dataset: { tag: '健康' } } })
  plan.onEditTime({ detail: { value: '19:00' } })
  plan.saveEdit()
  assert.strictEqual(plan.data.editing, false)

  var saved = store.getPlan(TOMORROW).items.filter(function (i) {
    return i.title === '去健身房练腿'
  })
  assert.strictEqual(saved.length, 1)
  assert.strictEqual(saved[0].time, '19:00')
  assert.strictEqual(saved[0].tag, '健康')
})

ok('改标题为空会被拦住', function () {
  var id = plan.data.items[0].id
  plan.openEdit({ currentTarget: { dataset: { id: id } } })
  plan.onEditTitle({ detail: { value: '   ' } })
  plan.saveEdit()
  assert.strictEqual(plan.data.editing, true)
  assert.ok(log.toast.indexOf('总得写点什么') >= 0)
  plan.closeEdit()
})

ok('删除一项', function () {
  var before = plan.data.total
  var id = plan.data.items[0].id
  plan.openEdit({ currentTarget: { dataset: { id: id } } })
  plan.onDelete()
  assert.strictEqual(plan.data.total, before - 1)
  assert.strictEqual(plan.data.editing, false)
})

console.log('\n[5] 首页追加 / 覆盖')

ok('已有清单时生成会弹选择，选追加', function () {
  behavior.tapIndex = 0
  var before = store.getPlan(TOMORROW).items.length
  index.setData({ draft: '下午三点 面试\n买牛奶', canSubmit: true })
  index.generate()
  var after = store.getPlan(TOMORROW).items.length
  assert.ok(after > before, '追加后应更多')
})

ok('重复标题不会重复追加', function () {
  var count = store.getPlan(TOMORROW).items.length
  index.setData({ draft: '买牛奶', canSubmit: true })
  index.generate()
  assert.strictEqual(store.getPlan(TOMORROW).items.length, count)
})

ok('选覆盖则只剩新的', function () {
  behavior.tapIndex = 1
  index.setData({ draft: '早起跑步', canSubmit: true })
  index.generate()
  var items = store.getPlan(TOMORROW).items
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].title, '早起跑步')
})

ok('空输入不打不闹', function () {
  var count = store.getPlan(TOMORROW).items.length
  index.setData({ draft: '   ', canSubmit: false })
  index.generate()
  assert.strictEqual(store.getPlan(TOMORROW).items.length, count)
  assert.ok(log.toast.indexOf('先写点要做的事') >= 0)
})

ok('识别不出内容也不会写坏数据', function () {
  var count = store.getPlan(TOMORROW).items.length
  index.setData({ draft: '明天下午三点', canSubmit: true })
  index.generate()
  assert.strictEqual(store.getPlan(TOMORROW).items.length, count)
})

console.log('\n[6] 清单页：清空与空状态')

ok('清空这一天的清单', function () {
  plan.clearDay()
  assert.strictEqual(plan.data.total, 0)
  assert.strictEqual(plan.data.isEmpty, true)
  assert.strictEqual(store.getPlan(TOMORROW), null)
})

ok('空状态能回首页', function () {
  var before = log.nav.length
  plan.goAdd()
  assert.ok(log.nav.length > before)
})

console.log('\n[7] 数据健壮性')

ok('坏掉的存储不会让页面崩', function () {
  mem[store.KEY] = 'this-is-not-an-object'
  index.onShow()
  assert.strictEqual(index.data.cards.length, 0)
  mem[store.KEY] = { plans: { bad: { items: 'oops' } }, draft: 123 }
  index.onShow()
  assert.strictEqual(index.data.cards.length, 0)
  assert.strictEqual(index.data.draft, '')
})

ok('只保留最近 45 天', function () {
  mem[store.KEY] = {
    plans: {
      '2000-01-01': { date: '2000-01-01', items: [{ title: '很老的事', time: '09:00' }] },
      [TOMORROW]: { date: TOMORROW, items: [{ title: '明天的事', time: '09:00' }] }
    },
    draft: ''
  }
  store.bootstrap()
  var state = mem[store.KEY]
  assert.ok(!state.plans['2000-01-01'], '老数据应被清掉')
  assert.ok(state.plans[TOMORROW], '近期数据应保留')
})

/* ---------------- 拆解页 ---------------- */

console.log('\n[8] 拆解页')

var bd = loadPage('../pages/breakdown/breakdown.js')

ok('进来是空的', function () {
  bd.onShow()
  assert.strictEqual(bd.data.card, null)
  assert.strictEqual(bd.data.cards.length, 0)
})

ok('拆一句话出卡片', function () {
  bd.onInput({ detail: { value: '把季度复盘会开得有个结果' } })
  assert.strictEqual(bd.data.canSubmit, true)
  bd.generate()
  assert.ok(bd.data.card, '应该出卡片')
  assert.strictEqual(bd.data.card.steps.length, 3)
  assert.strictEqual(bd.data.card.templateName, '开会 / 准备会')
  assert.strictEqual(bd.data.totalText, '20 分钟')
})

ok('改一步文字会落盘', function () {
  bd.onStepInput({
    currentTarget: { dataset: { idx: 0 } },
    detail: { value: '写下这次会要拿到的那个结论' }
  })
  bd.flush()
  var saved = store.getBreakdowns()[0]
  assert.strictEqual(saved.steps[0].text, '写下这次会要拿到的那个结论')
})

ok('点时长会轮换 5->10', function () {
  bd.cycleMinutes({ currentTarget: { dataset: { idx: 0 } } })
  assert.strictEqual(bd.data.card.steps[0].minutes, 10)
  assert.strictEqual(bd.data.totalText, '25 分钟')
})

ok('最多三步', function () {
  bd.addStep()
  assert.strictEqual(bd.data.card.steps.length, 3)
  assert.ok(log.toast.indexOf('1-2-3 就够了') >= 0)
})

ok('删到只剩一步时会拦一下', function () {
  bd.removeStep({ currentTarget: { dataset: { idx: 2 } } })
  bd.removeStep({ currentTarget: { dataset: { idx: 1 } } })
  assert.strictEqual(bd.data.card.steps.length, 1)
  bd.removeStep({ currentTarget: { dataset: { idx: 0 } } })
  assert.strictEqual(bd.data.card.steps.length, 1)
  assert.ok(log.toast.indexOf('至少留一步') >= 0)
})

ok('存为我的模板', function () {
  bd.saveAsTemplate()
  assert.strictEqual(store.getUserTemplates().length, 1)
})

console.log('\n[9] 拆解 -> 明天清单')

ok('还回去两步，凑够三步再排', function () {
  bd.addStep()
  bd.addStep()
  assert.strictEqual(bd.data.card.steps.length, 3)
})

ok('空步骤不让排', function () {
  var before = store.getPlan(dateUtil.tomorrow())
  var beforeCount = before ? before.items.length : 0
  bd.pushToPlan()
  var after = store.getPlan(dateUtil.tomorrow())
  var afterCount = after ? after.items.length : 0
  assert.strictEqual(afterCount, beforeCount)
  assert.ok(log.toast.indexOf('有一步还是空的') >= 0)
})

ok('填好之后排进明天', function () {
  var before = store.getPlan(dateUtil.tomorrow())
  var beforeCount = before ? before.items.length : 0

  var steps = bd.data.card.steps
  steps.forEach(function (s, i) { s.text = '第 ' + (i + 1) + ' 步' })
  bd.pushToPlan()

  var plan = store.getPlan(dateUtil.tomorrow())
  assert.strictEqual(plan.items.length, beforeCount + 3)
  assert.strictEqual(bd.data.card, null)

  var pushedTimes = plan.items.filter(function (it) {
    return it.title.indexOf('第 ') === 0
  }).map(function (it) { return it.time })
  assert.ok(pushedTimes.length === 3, '三步都应该在清单里')
  assert.ok(pushedTimes.every(function (t) { return t !== '09:00' }), '不能和已有事项撞时间')
})

ok('排完的卡片不再出现在待办里', function () {
  bd.onShow()
  assert.strictEqual(bd.data.cards.length, 0)
})

ok('拆解时会顺手问一下 AI', function () {
  bd.onInput({ detail: { value: '准备下周的面试' } })
  bd.generate()

  // 本地卡片先出来，AI 在后台跑
  assert.ok(bd.data.card, '本地模板应该已经有结果了')
  assert.strictEqual(bd.data.aiPending, true, '应该进入「AI 拆解中」状态')

  var last = log.cloud[log.cloud.length - 1]
  assert.strictEqual(last.name, 'askAI')
  assert.ok(last.data.user.indexOf('面试') >= 0, '目标要带过去')
  assert.ok(last.data.system.indexOf('{"steps"') > 0, 'system 里要有输出格式')
})

ok('AI 没配好时，模板结果照样能用', function () {
  var card = bd.data.card
  assert.ok(card.steps.length > 0, '模板三步必须还在')
  assert.ok(bd.data.totalText, '合计时间也算出来了')
})

/* ---------------- 复盘页 ---------------- */

console.log('\n[10] 复盘页')

var rv = loadPage('../pages/review/review.js')

ok('先给今天排个清单', function () {
  store.setPlan(TODAY, [
    { id: 'a1', title: '写周报', time: '09:00', duration: 45, tag: '工作', done: true },
    { id: 'a2', title: '交电费', time: '10:30', duration: 30, tag: '生活', done: true },
    { id: 'a3', title: '健身', time: '20:00', duration: 60, tag: '健康', done: false }
  ])
  rv.onShow()
  assert.strictEqual(rv.data.total, 3)
  assert.strictEqual(rv.data.doneCount, 2)
  assert.strictEqual(rv.data.rate, 67)
})

ok('写两句 + 打分', function () {
  rv.onInput({ detail: { value: '开会超时，健身没去' } })
  rv.onScore({ currentTarget: { dataset: { v: 3 } } })
  assert.strictEqual(rv.data.score, 3)
})

ok('生成评估', function () {
  rv.generate()
  assert.ok(rv.data.result, '应该有结果')
  assert.ok(rv.data.result.lines.length >= 3)
  assert.strictEqual(store.hasReview(TODAY), true)
})

ok('评估口径是中性的', function () {
  var all = rv.data.result.lines.join('')
  assert.ok(all.indexOf('计划 3 项，完成 2 项') >= 0)
  assert.ok(all.indexOf('健身') >= 0)
  assert.ok(all.indexOf('加油') < 0)
  assert.ok(all.indexOf('建议') < 0)
})

ok('历史里有今天', function () {
  assert.strictEqual(rv.data.history.length, 1)
  assert.strictEqual(rv.data.history[0].date, TODAY)
})

ok('复盘完首页就不再催了', function () {
  index.onShow()
  assert.strictEqual(index.data.needReview, false)
})

ok('再进来时评估还在', function () {
  rv.onShow()
  assert.ok(rv.data.result)
  assert.strictEqual(rv.data.score, 3)
})

ok('7 天趋势', function () {
  assert.strictEqual(rv.data.trend.length, 7)
  assert.strictEqual(rv.data.trend[6].date, TODAY)
  assert.strictEqual(rv.data.trend[6].has, true)
  assert.strictEqual(rv.data.trendHas, true)
  assert.ok(rv.data.trendAvg >= 0)
})

ok('没复盘的那几天是空柱', function () {
  var empty = rv.data.trend.filter(function (d) { return !d.has })
  assert.ok(empty.length >= 1, '过去 6 天没写复盘，应该有空柱')
  empty.forEach(function (d) { assert.strictEqual(d.height, 4) })
})

ok('同步日记：md 在本地渲染好再交给云函数', function () {
  var before = log.cloud.length
  var pending = rv.pushDiary()
  assert.ok(pending && typeof pending.then === 'function', '应该返回 Promise')

  assert.strictEqual(log.cloud.length, before + 1, '应该调了一次云函数')
  var call = log.cloud[log.cloud.length - 1]
  assert.strictEqual(call.name, 'pushDiary')
  assert.strictEqual(call.data.date, TODAY)

  var md = call.data.markdown
  assert.ok(md.indexOf('# ' + TODAY) >= 0, '标题带日期')
  assert.ok(md.indexOf('## 清单') >= 0, '有清单小节')
  assert.ok(md.indexOf('## 复盘') >= 0, '有复盘小节')
  assert.ok(md.indexOf('`09:00`') >= 0, '时间带反引号')
})

ok('生成评估时会自动推一次，不用点按钮', function () {
  var before = log.cloud.length
  rv.generate()
  assert.strictEqual(log.cloud.length, before + 1, '生成评估应该顺手推一次')
  assert.strictEqual(log.cloud[log.cloud.length - 1].name, 'pushDiary')
})

ok('云开发没初始化时会劝退，不会崩', function () {
  var saved = log.cloud.length
  var realCloud = global.wx.cloud
  global.wx.cloud = undefined
  // 直接调 utils/cloud.js 的判断
  var cloudUtil = require('../utils/cloud.js')
  assert.strictEqual(cloudUtil.available(), false)
  global.wx.cloud = realCloud
  assert.strictEqual(log.cloud.length, saved, '不该发出调用')
})

/* ---------------- 设置 ---------------- */

console.log('\n[11] 设置')

var st = loadPage('../pages/settings/settings.js')

ok('默认 20:00、提醒开着', function () {
  st.onShow()
  assert.strictEqual(st.data.settings.remindTime, '20:00')
  assert.strictEqual(st.data.settings.remindEnabled, true)
  assert.strictEqual(st.data.settings.breakdownStart, '09:00')
})

ok('改成 00:00 后首页立刻催', function () {
  st.onRemindTime({ detail: { value: '00:00' } })
  assert.strictEqual(store.getSettings().remindTime, '00:00')

  var raw = mem[store.KEY]
  delete raw.reviews[TODAY]        // 假装今天还没复盘

  index.onShow()
  assert.strictEqual(index.data.needReview, true)
  assert.strictEqual(index.data.remindTime, '00:00')
})

ok('关掉开关就不再催', function () {
  st.onToggleRemind({ detail: { value: false } })
  index.onShow()
  assert.strictEqual(index.data.needReview, false)
  st.onToggleRemind({ detail: { value: true } })
})

ok('拆解的起始时间也能改', function () {
  st.onBreakdownStart({ detail: { value: '14:00' } })
  assert.strictEqual(store.getSettings().breakdownStart, '14:00')
})

ok('坏掉的设置会被拉回默认值', function () {
  mem[store.KEY].settings = { remindTime: '乱写的', remindEnabled: 'yes' }
  var s = store.getSettings()
  assert.strictEqual(s.remindTime, '20:00')
  assert.strictEqual(s.remindEnabled, true)
})

/* ---------------- 模板与脚本对账 ---------------- */

var fs = require('fs')
var path = require('path')

function wxmlOf(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
}

var ALLOWED_LOCALS = ['item', 'row', 't', 'index', 'idx', 'true', 'false', 'null', 'undefined']
var JS_WORDS = ['length', 'trim', 'indexOf', 'String', 'Number']

function checkTemplate(name, relWxml, page) {
  var source = wxmlOf(relWxml)

  // 1) 事件绑定的方法必须在页面里存在
  var missHandlers = []
  var re = /(?:bind|catch)([a-z]+)\s*=\s*"([^"]+)"/g
  var m
  while ((m = re.exec(source))) {
    var handler = m[2]
    if (typeof page[handler] !== 'function') missHandlers.push(handler)
  }
  assert.deepStrictEqual(missHandlers, [], name + ' 里绑定了不存在的方? 实际: ' + missHandlers.join(','))

  // 2) {{}} 里用到的字段必须在 data 里（或循环变量）
  var dataKeys = Object.keys(page.data)
  var unknown = []
  var re2 = /\{\{([^}]+)\}\}/g
  while ((m = re2.exec(source))) {
    var expr = m[1].replace(/'[^']*'/g, ' ').replace(/"[^"]*"/g, ' ')
    // card.steps.length 这种只校验根标识符 card，属性名不管
    expr = expr.replace(/([A-Za-z_$][\w$]*)(\.[A-Za-z_$][\w$]*)+/g, '$1')
    var re3 = /[A-Za-z_$][\w$]*/g
    var t
    while ((t = re3.exec(expr))) {
      var word = t[0]
      if (ALLOWED_LOCALS.indexOf(word) >= 0) continue
      if (JS_WORDS.indexOf(word) >= 0) continue
      if (dataKeys.indexOf(word) >= 0) continue
      unknown.push(word)
    }
  }
  var uniq = unknown.filter(function (w, i) { return unknown.indexOf(w) === i })
  assert.deepStrictEqual(uniq, [], name + ' 里引用了 data 中没有的字段: ' + uniq.join(','))
}

console.log('\n[12] WXML 与 JS 对账')

ok('首页模板', function () { checkTemplate('index.wxml', 'pages/index/index.wxml', index) })
ok('清单页模板', function () { checkTemplate('plan.wxml', 'pages/plan/plan.wxml', plan) })
ok('拆解页模板', function () { checkTemplate('breakdown.wxml', 'pages/breakdown/breakdown.wxml', bd) })
ok('复盘页模板', function () { checkTemplate('review.wxml', 'pages/review/review.wxml', rv) })
ok('设置页模板', function () { checkTemplate('settings.wxml', 'pages/settings/settings.wxml', st) })

setImmediate(function () {
  ok('云函数返回成功后给了提示', function () {
    assert.ok(log.toast.indexOf('已同步到仓库') >= 0, '应该提示已同步，实际: ' + JSON.stringify(log.toast))
  })
  console.log('\n通过 ' + passed + ' 项，用时 ' + (Date.now() - startedAt.getTime()) + 'ms\n')
})
