/**
 * askAI：转发一次 DeepSeek 对话。
 *
 * 为什么不能在小程序里直连：
 *   ① 前端放 key，包一解就泄露；② 还要配 request 合法域名。
 *   云函数这两件事都省了，key 只存在云端环境变量里。
 *
 * 环境变量（云开发控制台 → 云函数 → 配置 → 环境变量）：
 *   DEEPSEEK_KEY    必填，platform.deepseek.com 生成的 API Key
 *   DEEPSEEK_MODEL  选填，默认 deepseek-chat
 *   ALLOWED_OPENID  选填，逗号分隔的白名单。填了就只允许这些用户调用
 *
 * 调用参数：{ system, user, maxTokens }
 * 返回：    { ok, text } 或 { ok:false, error }
 */

const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const HOST = 'api.deepseek.com'
const PATH = '/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

/** 一次请求最多给多久（秒）。云函数本身也要把超时调到 60 秒 */
const TIMEOUT_MS = 25000

function post(payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)

    const req = https.request(
      {
        hostname: HOST,
        port: 443,
        path: PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': 'Bearer ' + key
        }
      },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          let parsed = null
          try { parsed = data ? JSON.parse(data) : null } catch (e) { parsed = null }
          resolve({ status: res.statusCode, body: parsed, raw: data })
        })
      }
    )

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error('请求超时（' + TIMEOUT_MS / 1000 + ' 秒）'))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const key = process.env.DEEPSEEK_KEY
  if (!key) {
    return { ok: false, error: '缺少环境变量 DEEPSEEK_KEY' }
  }

  // 谁在调？白名单是可选的，但配上之后别人就刷不了你的额度
  let openid = ''
  try {
    openid = (cloud.getWXContext() || {}).OPENID || ''
  } catch (e) {}
  console.log('[askAI] openid =', openid)

  const allow = String(process.env.ALLOWED_OPENID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (allow.length && allow.indexOf(openid) < 0) {
    return { ok: false, error: '没有权限：openid 不在白名单里', openid: openid }
  }

  const system = String((event && event.system) || '').slice(0, 2000)
  const user = String((event && event.user) || '').slice(0, 1000)
  if (!user.trim()) return { ok: false, error: 'user 是空的' }

  const rawMax = Number(event && event.maxTokens)
  const maxTokens = Math.min(Math.max(rawMax || 400, 64), 1500)

  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: user })

  const payload = {
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    messages: messages,
    temperature: Number(event && event.temperature) || 0.3,
    max_tokens: maxTokens,
    stream: false
  }

  let res
  try {
    res = await post(payload, key)
  } catch (e) {
    return { ok: false, error: '请求失败：' + ((e && e.message) || e) }
  }

  if (res.status !== 200) {
    const msg = (res.body && res.body.error && res.body.error.message) || res.raw || ''
    return { ok: false, error: 'DeepSeek 返回 ' + res.status, detail: String(msg).slice(0, 300) }
  }

  const choice = res.body && res.body.choices && res.body.choices[0]
  const text = choice && choice.message && choice.message.content

  if (!text) {
    return { ok: false, error: '模型没返回内容' }
  }

  return {
    ok: true,
    text: String(text),
    model: payload.model,
    usage: (res.body && res.body.usage) || null
  }
}
