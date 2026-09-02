/**
 * 汽水音乐 IPC（仅歌单导入）：扫码登录、登录状态、歌单拉取。
 * Cookie 存储方式与网易云一致（safeStorage 加密文件）。
 * 播放不接入汽水接口——导入的歌以 source 'qishui' 存储，播放时由应用内
 * 音源/换源机制（handleGetOnlineMusicUrl → getOtherSource）自动解析。
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { getQrCode, checkQrConnect, getCookie, clear as clearAuth } from '../../qishui/auth-v6'
import { clearConfig } from '../../qishui/auth-config'
import {
  getQishuiLibrary,
  getQishuiPlaylistTracks,
  type QishuiTrackInfo,
  normalizeQishuiCookieInput,
  qishuiCookieHasLogin,
  qishuiCookieUserId,
} from '../../qishui/qishui-api'

const cookieFile = () => path.join(global.lxDataPath, 'qishui-cookie.bin')

const readQishuiCookie = (): string => {
  try {
    if (!existsSync(cookieFile())) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(readFileSync(cookieFile()))
  } catch (_) {
    return ''
  }
}

const persistQishuiCookie = (cookie: string) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_UNAVAILABLE')
  writeFileSync(cookieFile(), safeStorage.encryptString(cookie), { mode: 0o600 })
}

export default () => {
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qishui_status, async() => {
    const cookie = readQishuiCookie()
    return {
      loggedIn: qishuiCookieHasLogin(cookie),
      userId: qishuiCookieUserId(cookie),
    }
  })

  // ---------- 官方扫码登录 ----------
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qishui_qr_create, async() => {
    const result = await getQrCode()
    const data = result?.data || {}
    return {
      token: String(data.token || ''),
      qrcode: String(data.qrcode || ''),
      qrcodeIndexUrl: String(data.qrcode_index_url || ''),
      scanUrl: String(data.scan_url || ''),
      expireTime: Number(data.expire_time || data.expireTime || 0),
    }
  })

  mainHandle<string, { loggedIn: boolean, status: string, errorCode: number }>(WIN_MAIN_RENDERER_EVENT_NAME.qishui_qr_check, async({ params }) => {
    const token = String(params || '')
    if (!token) throw new Error('QISHUI_QR_TOKEN_REQUIRED')
    const result = await checkQrConnect(token)
    const data = result?.data || {}
    const errorCode = Number(data.error_code || 0)
    const rawStatus = String(data.status || '')
    const status = errorCode === 2
      ? 'expired'
      : errorCode === 7
        ? 'rate_limited'
        : rawStatus === '2'
          ? 'scanned'
          : 'waiting'
    const confirmed = errorCode === 0 && (rawStatus === '3' || rawStatus === 'confirmed' || data.session_cookie)
    if (confirmed) {
      const cookie = getCookie()
      if (qishuiCookieHasLogin(cookie)) {
        persistQishuiCookie(normalizeQishuiCookieInput(cookie))
        return { loggedIn: true, status: 'confirmed', errorCode }
      }
      throw new Error('QISHUI_QR_SESSION_COOKIE_MISSING')
    }
    return { loggedIn: false, status, errorCode }
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qishui_qr_clear, async() => {
    await clearAuth()
    clearConfig()
    if (existsSync(cookieFile())) unlinkSync(cookieFile())
  })

  // ---------- 歌单导入 ----------
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qishui_get_library, async() => {
    const cookie = readQishuiCookie()
    if (!qishuiCookieHasLogin(cookie)) throw new Error('QISHUI_LOGIN_REQUIRED')
    return getQishuiLibrary(cookie)
  })

  mainHandle<string, QishuiTrackInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.qishui_get_playlist_tracks, async({ params }) => {
    const cookie = readQishuiCookie()
    if (!qishuiCookieHasLogin(cookie)) throw new Error('QISHUI_LOGIN_REQUIRED')
    return getQishuiPlaylistTracks(cookie, params)
  })
}
