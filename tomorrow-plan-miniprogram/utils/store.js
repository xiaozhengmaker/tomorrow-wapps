/**
 * 本地存储：一天一份清单，全在手机里，不上传任何服务器。
 */

var dateUtil = require('./date.js')

var KEY = 'tp_state_v2'
var KEEP_DAYS = 45

var DEFAULT_SETTINGS = {
  remindEnabled: true,
  remindTime: '20:00',
  breakdownStart: '09:00'
}

function blank() {
  return {
    version: 4,
    plans: {},
    draft: '',
    breakdowns: [],
    templates: [],
    reviews: {},
    settings: {
      remindEnabled: DEFAULT_SETTINGS.remindEnabled,
      remindTime: DEFAULT_SETTINGS.remindTime,
      breakdownStart: DEFAULT_SETTINGS.breakdownStart
    }
  }
}

function read() {
  var raw = ''
  try {
    raw = wx.getStorageSync(KEY)
  } catch (e) {
    console.error('[store] 读取失败', e)
    raw = ''
  }
  if (!raw || typeof raw !== 'object') return blank()
  if (!raw.plans || typeof raw.plans !== 'object') raw.plans = {}
  if (typeof raw.draft !== 'string') raw.draft = ''
  if (!Array.isArray(raw.breakdowns)) raw.breakdowns = []
  if (!Array.isArray(raw.templates)) raw.templates = []
  if (!raw.reviews || typeof raw.reviews !== 'object') raw.reviews = {}

  if (!raw.settings || typeof raw.settings !== 'object') raw.settings = {}
  if (typeof raw.settings.remindEnabled !== 'boolean') {
    raw.settings.remindEnabled = DEFAULT_SETTINGS.remindEnabled
  }
  if (!/^\d{2}:\d{2}$/.test(raw.settings.remindTime || '')) {
    raw.settings.remindTime = DEFAULT_SETTINGS.remindTime
  }
  if (!/^\d{2}:\d{2}$/.test(raw.settings.breakdownStart || '')) {
    raw.settings.breakdownStart = DEFAULT_SETTINGS.breakdownStart
  }

  return raw
}

function write(state) {
  try {
    wx.setStorageSync(KEY, state)
  } catch (e) {
    console.error('[store] 写入失败', e)
  }
  return state
}

function newId() {
  return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)
}

function normalizeItem(it) {
  it = it || {}
  return {
    id: it.id || newId(),
    title: String(it.title || '').trim(),
    time: it.time || '09:00',
    duration: parseInt(it.duration, 10) || 30,
    tag: it.tag || '其他',
    important: !!it.important,
    assigned: !!it.assigned,
    done: !!it.done,
    progress: String(it.progress || '').slice(0, 60).trim()
  }
}

function normalizeItems(items) {
  return (items || [])
    .map(normalizeItem)
    .filter(function (it) { return !!it.title })
}

/** 丢掉太久以前的记录，避免存储无限增长 */
function prune(state) {
  var floor = dateUtil.shift(dateUtil.today(), -KEEP_DAYS)
  Object.keys(state.plans).forEach(function (d) {
    if (d < floor) delete state.plans[d]
  })
  Object.keys(state.reviews).forEach(function (d) {
    if (d < floor) delete state.reviews[d]
  })
  state.breakdowns = state.breakdowns.filter(function (c) {
    return !c.createdAt || c.createdAt > Date.now() - KEEP_DAYS * 86400000
  })
  return state
}

function bootstrap() {
  var state = read()
  prune(state)
  write(state)
  return state
}

function getPlan(date) {
  var state = read()
  var plan = state.plans[date]
  if (!plan || !Array.isArray(plan.items) || !plan.items.length) return null
  return plan
}

function setPlan(date, items, source) {
  var state = read()
  var clean = normalizeItems(items)
  if (!clean.length) {
    delete state.plans[date]
    write(state)
    return null
  }
  state.plans[date] = {
    date: date,
    source: String(source || '').slice(0, 600),
    updatedAt: Date.now(),
    items: clean
  }
  write(state)
  return state.plans[date]
}

function appendItems(date, items, source) {
  var state = read()
  var plan = state.plans[date]
  var existing = plan && Array.isArray(plan.items) ? plan.items.slice() : []
  var seen = {}
  existing.forEach(function (it) { seen[it.title] = 1 })

  var added = 0
  normalizeItems(items).forEach(function (it) {
    if (seen[it.title]) return
    seen[it.title] = 1
    existing.push(it)
    added++
  })

  if (!existing.length) return { plan: null, added: 0 }

  state.plans[date] = {
    date: date,
    source: plan ? plan.source : String(source || '').slice(0, 600),
    updatedAt: Date.now(),
    items: existing
  }
  write(state)
  return { plan: state.plans[date], added: added }
}

function updateItem(date, id, patch) {
  var state = read()
  var plan = state.plans[date]
  if (!plan || !Array.isArray(plan.items)) return null
  var hit = false
  plan.items = plan.items.map(function (it) {
    if (it.id !== id) return it
    hit = true
    var next = {}
    for (var k in it) if (it.hasOwnProperty(k)) next[k] = it[k]
    for (var k2 in patch) if (patch.hasOwnProperty(k2)) next[k2] = patch[k2]
    return normalizeItem(next)
  })
  if (!hit) return null
  plan.updatedAt = Date.now()
  write(state)
  return plan
}

function toggleItem(date, id) {
  var state = read()
  var plan = state.plans[date]
  if (!plan || !Array.isArray(plan.items)) return null
  plan.items = plan.items.map(function (it) {
    if (it.id !== id) return it
    var next = {}
    for (var k in it) if (it.hasOwnProperty(k)) next[k] = it[k]
    next.done = !it.done
    return next
  })
  plan.updatedAt = Date.now()
  write(state)
  return plan
}

function removeItem(date, id) {
  var state = read()
  var plan = state.plans[date]
  if (!plan || !Array.isArray(plan.items)) return null
  plan.items = plan.items.filter(function (it) { return it.id !== id })
  if (!plan.items.length) {
    delete state.plans[date]
    write(state)
    return null
  }
  plan.updatedAt = Date.now()
  write(state)
  return plan
}

function markAll(date, done) {
  var state = read()
  var plan = state.plans[date]
  if (!plan || !Array.isArray(plan.items)) return null
  plan.items = plan.items.map(function (it) {
    var next = {}
    for (var k in it) if (it.hasOwnProperty(k)) next[k] = it[k]
    next.done = !!done
    return next
  })
  plan.updatedAt = Date.now()
  write(state)
  return plan
}

function clearPlan(date) {
  var state = read()
  delete state.plans[date]
  write(state)
}

function listDates() {
  var state = read()
  return Object.keys(state.plans).sort().reverse()
}

function getDraft() {
  return read().draft
}

function setDraft(text) {
  var state = read()
  state.draft = String(text || '').slice(0, 600)
  write(state)
}

/* ---------------- 拆解卡 ---------------- */

function getBreakdowns() {
  return read().breakdowns.slice().sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}

function addBreakdown(card) {
  var state = read()
  state.breakdowns.unshift(card)
  state.breakdowns = state.breakdowns.slice(0, 40)
  write(state)
  return card
}

function updateBreakdown(id, patch) {
  var state = read()
  var hit = null
  state.breakdowns = state.breakdowns.map(function (c) {
    if (c.id !== id) return c
    hit = {}
    for (var k in c) if (c.hasOwnProperty(k)) hit[k] = c[k]
    for (var k2 in patch) if (patch.hasOwnProperty(k2)) hit[k2] = patch[k2]
    return hit
  })
  write(state)
  return hit
}

function removeBreakdown(id) {
  var state = read()
  state.breakdowns = state.breakdowns.filter(function (c) { return c.id !== id })
  write(state)
}

/* ---------------- 我的模板 ---------------- */

function getUserTemplates() {
  return read().templates
}

function saveUserTemplate(tpl) {
  var state = read()
  var exists = false
  state.templates = state.templates.map(function (t) {
    if (t.id !== tpl.id) return t
    exists = true
    return tpl
  })
  if (!exists) state.templates.unshift(tpl)
  state.templates = state.templates.slice(0, 20)
  write(state)
  return tpl
}

/* ---------------- 复盘 ---------------- */

function getReview(date) {
  var state = read()
  return state.reviews[date] || null
}

function saveReview(review) {
  var state = read()
  state.reviews[review.date] = review
  write(state)
  return review
}

function listReviews(limit) {
  var state = read()
  return Object.keys(state.reviews)
    .sort()
    .reverse()
    .slice(0, limit || 7)
    .map(function (d) { return state.reviews[d] })
}

function hasReview(date) {
  return !!read().reviews[date]
}

/* ---------------- 设置 ---------------- */

function getSettings() {
  return read().settings
}

function saveSettings(patch) {
  var state = read()
  for (var k in patch) {
    if (patch.hasOwnProperty(k)) state.settings[k] = patch[k]
  }
  write(state)
  return state.settings
}

module.exports = {
  KEY: KEY,
  DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  bootstrap: bootstrap,
  getPlan: getPlan,
  setPlan: setPlan,
  appendItems: appendItems,
  updateItem: updateItem,
  toggleItem: toggleItem,
  removeItem: removeItem,
  markAll: markAll,
  clearPlan: clearPlan,
  listDates: listDates,
  getDraft: getDraft,
  setDraft: setDraft,
  getBreakdowns: getBreakdowns,
  addBreakdown: addBreakdown,
  updateBreakdown: updateBreakdown,
  removeBreakdown: removeBreakdown,
  getUserTemplates: getUserTemplates,
  saveUserTemplate: saveUserTemplate,
  getReview: getReview,
  saveReview: saveReview,
  listReviews: listReviews,
  hasReview: hasReview,
  getSettings: getSettings,
  saveSettings: saveSettings
}
