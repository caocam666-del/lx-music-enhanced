/**
 * 酷狗音乐 IPC（导入歌单）：Cookie 存储、登录状态、歌单拉取。
 * Cookie 从 kugou.com 网页登录会话复制，safeStorage 加密保存（同网易云模式）。
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'node:path'
import { BrowserWindow, safeStorage } from 'electron'
import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { extractKugouAuth, getKugouLibrary, getKugouPlaylistTracks, kugouCookieHasLogin, type KugouTrackInfo } from '../../kugou/kugou-api'
import { openKugouLoginWindow } from '../../kugou/loginWindow'

const cookieFile = () => path.join(global.lxDataPath, 'kugou-cookie.bin')

const readKugouCookie = (): string => {
  try {
    if (!existsSync(cookieFile())) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(readFileSync(cookieFile()))
  } catch (_) {
    return ''
  }
}

export default () => {
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.kugou_status, async() => {
    const auth = extractKugouAuth(readKugouCookie())
    return { loggedIn: auth.loggedIn, playbackReady: auth.playbackReady, userId: auth.userid, nickname: auth.nickname }
  })

  mainHandle<string, undefined>(WIN_MAIN_RENDERER_EVENT_NAME.kugou_set_cookie, async({ params }) => {
    const cookie = String(params || '').trim()
    if (!cookie) throw new Error('INVALID_COOKIE')
    if (!kugouCookieHasLogin(cookie)) throw new Error('KUGOU_AUTH_REQUIRED')
    if (!safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_UNAVAILABLE')
    writeFileSync(cookieFile(), safeStorage.encryptString(cookie), { mode: 0o600 })
    return undefined
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.kugou_clear_cookie, async() => {
    if (existsSync(cookieFile())) unlinkSync(cookieFile())
  })

  // 扫码登录: 打开酷狗官方登录窗口, 完成后自动捕获会话 Cookie
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.kugou_open_login_window, async({ event }) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    return openKugouLoginWindow(owner)
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.kugou_get_library, async() => {
    const cookie = readKugouCookie()
    if (!kugouCookieHasLogin(cookie)) throw new Error('KUGOU_AUTH_REQUIRED')
    return getKugouLibrary(cookie)
  })

  mainHandle<string, KugouTrackInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.kugou_get_playlist_tracks, async({ params }) => {
    const cookie = readKugouCookie()
    if (!kugouCookieHasLogin(cookie)) throw new Error('KUGOU_AUTH_REQUIRED')
    return getKugouPlaylistTracks(cookie, params)
  })
}
