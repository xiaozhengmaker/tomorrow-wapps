/**
 * pushDiary：把当天的 Markdown 日记提交到 GitHub 仓库的一个目录。
 *
 * 设计取舍：
 *   md 在小程序端渲染（utils/diary.js 只有一份），云函数只负责「写文件」。
 *   云函数里再放一份渲染逻辑，迟早两边跑偏。
 *
 * 两种触发方式：
 *   1. 小程序调用 { date, markdown }        —— 立刻推，成功后记进 outbox
 *   2. 定时触发器（每天 23:40）              —— 把 outbox 里没推成功的重试一遍
 *
 * 环境变量：
 *   GITHUB_TOKEN   fine-grained PAT，只给这一个仓库 Contents: Read and write
 *   GITHUB_REPO    owner/repo
 *   GITHUB_BRANCH  默认 main
 *   GITHUB_DIR     默认 Daily
 */

const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_HOST = 'api.github.com'
const COLLECTION = 'diary_outbox'

/* ---------------- GitHub ---------------- */

function gh(method, path, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null

    const headers = {
      'User-Agent': 'tomorrow-plan-cloudfunction',
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(body)
    }

    const req = https.request(
      { hostname: API_HOST, port: 443, path: path, method: method, headers: headers },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          let parsed = null
          try { parsed = data ? JSON.parse(data) : null } catch (e) { parsed = null }
          resolve({ status: res.statusCode, body: parsed })
        })
      }
    )

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function commitMarkdown(date, markdown) {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'
  const dir = (process.env.GITHUB_DIR || 'Daily').replace(/^\/+|\/+$/g, '')

  if (!token || !repo) {
    return { ok: false, error: '缺少环境变量 GITHUB_TOKEN 或 GITHUB_REPO' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'date 格式不对' }
  if (!String(markdown || '').trim()) return { ok: false, error: 'markdown 是空的' }

  const filePath = dir ? dir + '/' + date + '.md' : date + '.md'
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  const apiPath = '/repos/' + repo + '/contents/' + encoded
  const content = Buffer.from(markdown, 'utf8').toString('base64')

  // 先看文件在不在，拿到 sha（有就是更新，没有就是新建）
  const head = await gh('GET', apiPath + '?ref=' + encodeURIComponent(branch), token)

  let sha = null
  if (head.status === 200 && head.body && head.body.sha) {
    sha = head.body.sha
  } else if (head.status !== 404) {
    return {
      ok: false,
      error: '读取仓库失败（' + head.status + '）',
      detail: (head.body && head.body.message) || ''
    }
  }

  const payload = { message: 'daily: ' + filePath, content: content, branch: branch }
  if (sha) payload.sha = sha

  const put = await gh('PUT', apiPath, token, payload)

  if (put.status !== 200 && put.status !== 201) {
    return {
      ok: false,
      error: '提交失败（' + put.status + '）',
      detail: (put.body && put.body.message) || ''
    }
  }

  const commit = put.body && put.body.commit && put.body.commit.sha

  return {
    ok: true,
    path: filePath,
    created: !sha,
    commit: commit ? commit.slice(0, 7) : ''
  }
}

/* ---------------- 队列 ---------------- */

/** 记一笔到 outbox。集合不存在、没权限都不影响主流程 */
async function remember(date, markdown, result) {
  try {
    await cloud.database().collection(COLLECTION).doc(date).set({
      data: {
        date: date,
        markdown: markdown,
        pushed: !!result.ok,
        error: result.ok ? '' : (result.error || ''),
        updatedAt: Date.now()
      }
    })
  } catch (e) {
    // 没建集合 / 没权限，忽略
  }
}

async function retryQueue() {
  let list = null
  try {
    list = await cloud.database().collection(COLLECTION)
      .where({ pushed: false })
      .limit(20)
      .get()
  } catch (e) {
    return { ok: true, mode: 'timer', retried: 0, note: 'outbox 读不到，跳过' }
  }

  const docs = (list && list.data) || []
  let done = 0
  const failed = []

  for (const doc of docs) {
    const result = await commitMarkdown(String(doc.date || ''), String(doc.markdown || ''))
    if (result.ok) {
      done++
      try {
        await cloud.database().collection(COLLECTION).doc(doc._id).update({
          data: { pushed: true, error: '', updatedAt: Date.now() }
        })
      } catch (e) {}
    } else {
      failed.push({ date: doc.date, error: result.error })
    }
  }

  return { ok: true, mode: 'timer', retried: docs.length, succeeded: done, failed: failed }
}

/* ---------------- 入口 ---------------- */

exports.main = async (event) => {
  // 定时触发器
  if (event && (event.Type === 'Timer' || event.type === 'timer')) {
    return retryQueue()
  }

  const date = String((event && event.date) || '').trim()
  const markdown = String((event && event.markdown) || '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'date 格式不对' }
  if (!markdown.trim()) return { ok: false, error: 'markdown 是空的' }

  let result
  try {
    result = await commitMarkdown(date, markdown)
  } catch (e) {
    result = { ok: false, error: '网络异常：' + (e && e.message) }
  }

  await remember(date, markdown, result)

  return Object.assign({ mode: 'direct' }, result)
}
