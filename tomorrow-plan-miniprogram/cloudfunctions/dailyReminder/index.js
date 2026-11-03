/**
 * dailyReminder：复盘提醒。
 *
 * 两种调用：
 *   1. 小程序调用 { status: 'accept' } —— 用户刚点过「允许订阅」，给他记一条额度
 *   2. 定时触发器（每天 20:00）      —— 把额度 > 0 的人各发一条，发完扣 1
 *
 * 关于「一次性订阅」这个硬限制：
 *   微信的一次性订阅消息，用户点一次「允许」只能换一条推送。
 *   所以想每天晚上收到，就得每天晚上（或某个时间）再点一次允许。
 *   这不是实现问题，是平台规则；长期订阅只对特定类目开放，个人拿不到。
 *
 * 环境变量：
 *   SUBSCRIBE_TEMPLATE_ID  必填，小程序后台「订阅消息」里申请到的模板 ID
 *   SUBSCRIBE_PAGE         点击消息打开的页面，默认 pages/review/review
 *   SUBSCRIBE_DATA         选填，模板字段 JSON，默认 {"thing1":{"value":"今天还没复盘"},"time2":{"value":"20:00"}}
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const COLLECTION = 'remind_subscribers'

const DEFAULT_DATA = {
  thing1: { value: '今天还没复盘' },
  time2: { value: '20:00' }
}

function buildData() {
  const raw = process.env.SUBSCRIBE_DATA
  if (!raw) return DEFAULT_DATA
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : DEFAULT_DATA
  } catch (e) {
    return DEFAULT_DATA
  }
}

/** 用户刚授权：记一条额度（封顶 3，防止连点堆一堆） */
async function subscribe() {
  const ctx = cloud.getWXContext() || {}
  const openid = ctx.OPENID
  if (!openid) return { ok: false, error: '拿不到 openid' }

  const db = cloud.database()
  let left = 1

  try {
    const doc = await db.collection(COLLECTION).doc(openid).get()
    left = Math.min(3, ((doc.data && doc.data.left) || 0) + 1)
  } catch (e) {
    left = 1 // 文档不存在
  }

  await db.collection(COLLECTION).doc(openid).set({
    data: { openid: openid, left: left, updatedAt: Date.now() }
  })

  return { ok: true, subscribed: true, left: left }
}

/** 定时任务：给有额度的人发一条 */
async function sendAll() {
  const tmplId = process.env.SUBSCRIBE_TEMPLATE_ID
  if (!tmplId) return { ok: false, error: '缺少环境变量 SUBSCRIBE_TEMPLATE_ID' }

  const page = process.env.SUBSCRIBE_PAGE || 'pages/review/review'
  const db = cloud.database()
  const _ = db.command

  let list
  try {
    list = await db.collection(COLLECTION).where({ left: _.gt(0) }).limit(50).get()
  } catch (e) {
    return { ok: true, mode: 'timer', sent: 0, note: '集合读不到，跳过' }
  }

  const docs = (list && list.data) || []
  let sent = 0
  const errors = []

  for (const doc of docs) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: doc.openid,
        templateId: tmplId,
        page: page,
        data: buildData()
      })
      sent++
      await db.collection(COLLECTION).doc(doc._id).update({
        data: { left: Math.max(0, (doc.left || 1) - 1), updatedAt: Date.now() }
      })
    } catch (e) {
      const msg = String((e && e.message) || e)
      errors.push({ openid: doc.openid, error: msg })
      // 43101 = 用户拒收；额度作废，别天天重试
      try {
        await db.collection(COLLECTION).doc(doc._id).update({
          data: { left: 0, error: msg, updatedAt: Date.now() }
        })
      } catch (e2) {}
    }
  }

  return { ok: true, mode: 'timer', sent: sent, total: docs.length, errors: errors }
}

exports.main = async (event) => {
  if (event && (event.Type === 'Timer' || event.type === 'timer')) {
    return sendAll()
  }
  return subscribe()
}
