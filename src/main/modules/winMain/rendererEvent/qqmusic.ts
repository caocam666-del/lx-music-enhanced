/**
 * QQ 音乐 IPC（导入歌单）：Cookie 存储、登录状态、歌单拉取。
 * Cookie 从 y.qq.com 网页登录会话复制（需 uin + qm_keyst），safeStorage 加密保存。
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'node:path'
import { BrowserWindow, safeStorage } from 'electron'
import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { extractQQAuth, getQQLibrary, getQQPlaylistTracks, normalizeQQCookieInput, qqCookieHasLogin, type QQTrackInfo } from '../../qqmusic/qq-api'
import { openQQLoginWindow } from '../../qqmusic/loginWindow'

const cookieFile = () => path.join(global.lxDataPath, 'qq-cookie.bin')

const readQQCookie = (): string => {
  try {
    if (!existsSync(cookieFile())) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(readFileSync(cookieFile()))
  } catch (_) {
    return ''
  }
}

export default () => {
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qq_status, async() => {
    const auth = extractQQAuth(readQQCookie())
    return { loggedIn: auth.loggedIn, playbackReady: auth.playbackReady, userId: auth.uin }
  })

  mainHandle<string, undefined>(WIN_MAIN_RENDERER_EVENT_NAME.qq_set_cookie, async({ params }) => {
    const cookie = normalizeQQCookieInput(String(params || '').trim())
    if (!cookie) throw new Error('INVALID_COOKIE')
    if (!qqCookieHasLogin(cookie)) throw new Error('QQ_AUTH_REQUIRED')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_UNAVAILABLE')
    writeFileSync(cookieFile(), safeStorage.encryptString(cookie), { mode: 0o600 })
    return undefined
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qq_clear_cookie, async() => {
    if (existsSync(cookieFile())) unlinkSync(cookieFile())
  })

  // 扫码登录: 打开 QQ 音乐官方登录窗口, 完成后自动捕获会话 Cookie
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qq_open_login_window, async({ event }) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    return openQQLoginWindow(owner)
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.qq_get_library, async() => {
    const cookie = readQQCookie()
    if (!qqCookieHasLogin(cookie)) throw new Error('QQ_AUTH_REQUIRED')
    return getQQLibrary(cookie)
  })

  mainHandle<string, QQTrackInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.qq_get_playlist_tracks, async({ params }) => {
    const cookie = readQQCookie()
    if (!qqCookieHasLogin(cookie)) throw new Error('QQ_AUTH_REQUIRED')
    return getQQPlaylistTracks(cookie, params)
  })
}
