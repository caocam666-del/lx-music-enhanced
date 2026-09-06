/**
 * Luminous Harmonic: 网易云官方扫码登录。
 * 接口协议按 NeteaseCloudMusicApi 4.32.0（GPL-3.0 项目验证过的端点）：
 * - 匿名注册: weapi /api/register/anonimous → 匿名 MUSIC_A token（缓存复用）
 * - key:     eapi POST interface.music.163.com /api/login/qrcode/unikey  { type: 3, header }
 * - 二维码:   客户端本地生成（qrcode 包），内容为 https://music.163.com/login?codekey=<key>
 * - check:   eapi POST /api/login/qrcode/client/login  { key, type: 3, header }
 *   状态码：801 等待扫码 / 802 已扫待确认 / 800 已过期 / 803 成功（set-cookie 带登录态）。
 */
import { createHash, randomBytes } from 'node:crypto'
import { httpFetch } from '../../request'
import { eapi, weapi } from './utils/crypto'

const API_DOMAIN = 'https://interface.music.163.com'
const IPHONE_UA = 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)'
const EDGE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
const ID_XOR_KEY = '3go8&$8*3*3h0k(2)2'

const QRCODE = require('qrcode') // eslint-disable-line @typescript-eslint/no-var-requires

// ---------- 匿名 token（设备注册，缓存复用） ----------

const dllEncodeId = (id) => {
  let xored = ''
  for (let i = 0; i < id.length; i++) {
    xored += String.fromCharCode(id.charCodeAt(i) ^ ID_XOR_KEY.charCodeAt(i % ID_XOR_KEY.length))
  }
  return createHash('md5').update(xored, 'utf8').digest('base64')
}

let anonymousToken = window.localStorage.getItem('lx_netease_anon_token') ?? ''

const registerAnonymous = async() => {
  const chars = '0123456789ABCDEF'
  let deviceId = ''
  for (let i = 0; i < 52; i++) deviceId += chars[Math.floor(Math.random() * chars.length)]
  const username = Buffer.from(`${deviceId} ${dllEncodeId(deviceId)}`, 'utf8').toString('base64')
  const resp = await httpFetch('https://music.163.com/weapi/register/anonimous', {
    method: 'post',
    headers: {
      'User-Agent': EDGE_UA,
      Referer: 'https://music.163.com',
    },
    form: weapi({ username }),
  }).promise
  const setCookie = (resp.headers ?? {})['set-cookie'] ?? []
  const cookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : ''
  const match = cookie.match(/MUSIC_A=([^;]+)/)
  if (!match) throw new Error('匿名注册失败')
  anonymousToken = match[1]
  window.localStorage.setItem('lx_netease_anon_token', anonymousToken)
  return anonymousToken
}

const getAnonymousToken = async() => {
  if (anonymousToken) return anonymousToken
  try {
    return await registerAnonymous()
  } catch (_) {
    // 失败重试一次
    return await registerAnonymous()
  }
}

// ---------- eapi 请求（完整 NCM cookie/header 信封） ----------

const buildCookie = musicA => {
  const nuid = randomBytes(16).toString('hex')
  return {
    os: 'pc',
    appver: '8.9.75',
    versioncode: '140',
    mobilename: '',
    buildver: String(Date.now()).substr(0, 10),
    resolution: '1920x1080',
    __csrf: '',
    channel: 'netease',
    osver: 'Windows 10',
    __remember_me: 'true',
    ntes_kaola_ad: '1',
    _ntes_nuid: nuid,
    _ntes_nnid: `${nuid},${Date.now()}`,
    WNMCID: '676666.1610136596930.01.0',
    WEVNSM: '1.0.0',
    MUSIC_A: musicA,
  }
}

const headerCookie = cookie =>
  Object.keys(cookie).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(cookie[k])}`).join('; ')

const eapiPost = async(uri, data) => {
  const musicA = await getAnonymousToken()
  const cookie = buildCookie(musicA)
  const header = {
    osver: cookie.osver,
    os: cookie.os,
    appver: cookie.appver,
    versioncode: cookie.versioncode,
    mobilename: cookie.mobilename,
    buildver: cookie.buildver,
    resolution: cookie.resolution,
    __csrf: cookie.__csrf,
    channel: cookie.channel,
    requestId: `${Date.now()}_${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
    MUSIC_A: musicA,
  }
  const encrypted = eapi(uri, { ...data, header })
  const resp = await httpFetch(API_DOMAIN + '/eapi' + uri.substr(4), {
    method: 'post',
    headers: {
      'User-Agent': IPHONE_UA,
      Cookie: headerCookie(cookie),
    },
    form: encrypted,
  }).promise
  const headers = resp.headers ?? {}
  const setCookie = headers['set-cookie'] ?? headers['Set-Cookie'] ?? []
  return { body: resp.body ?? {}, setCookie: Array.isArray(setCookie) ? setCookie : [] }
}

// ---------- 对外接口 ----------

export const loginQrKey = async() => {
  const { body } = await eapiPost('/api/login/qrcode/unikey', { type: 3 })
  const key = body?.unikey ?? body?.data?.unikey
  if (!key) throw new Error(body?.message ?? '获取二维码失败')
  return String(key)
}

export const loginQrCreate = async(key) => {
  const qrurl = `https://music.163.com/login?codekey=${key}`
  const qrimg = await QRCODE.toDataURL(qrurl, { errorCorrectionLevel: 'M', margin: 2, width: 360 })
  return { qrimg, qrurl }
}

export const loginQrCheck = async(key) => {
  const { body, setCookie } = await eapiPost('/api/login/qrcode/client/login', { key, type: 3 })
  const code = Number(body?.code)
  switch (code) {
    case 803: {
      const cookie = setCookie.map(c => c.split(';')[0]).join('; ')
      if (!/MUSIC_U=/.test(cookie)) throw new Error('登录成功但未取得 Cookie')
      return { status: 'success', cookie }
    }
    case 802:
      return { status: 'scanned' }
    case 800:
      return { status: 'expired' }
    case 801:
      return { status: 'waiting' }
    default:
      return { status: 'waiting', message: body?.message }
  }
}
