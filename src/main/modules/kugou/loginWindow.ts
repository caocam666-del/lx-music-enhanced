/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-floating-promises, @typescript-eslint/await-thenable, @typescript-eslint/prefer-nullish-coalescing, require-atomic-updates, promise/param-names -- BrowserWindow 事件驱动登录流程, 轮询/回调中的 promise 用法为该模式固有形态 (移植自 Mineradio GPL-3.0) */
/**
 * 酷狗音乐官方网页登录窗口（扫码登录）。
 * 移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）desktop/main.js 的
 * openKugouMusicLoginWindow，纯自用集成。
 * 流程：打开 kugou.com 官方窗口（页面自带二维码/账号登录）→ 自动点击"登录" →
 * 轮询会话 Cookie，出现 userid+token（可播放登录态）后回传 Cookie 字符串。
 */
import { BrowserWindow, session, shell } from 'electron'
import { extractKugouAuth } from './kugou-api'

const KUGOU_LOGIN_PARTITION = 'persist:lx-kugou-login'
const KUGOU_LOGIN_URL = 'https://www.kugou.com/'
const KUGOU_LOGIN_WARMUP_URL = 'https://www.kugou.com/newuc/user/uc/type=edit'

const AUTO_LOGIN_SCRIPT = `
  setTimeout(() => {
    const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
    const loginNode = nodes.find((node) => {
      const text = (node.textContent || '').trim();
      if (!/登录|登陆/.test(text)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (loginNode) loginNode.click();
  }, 700);
`

export interface WebLoginResult {
  ok: boolean
  cookie?: string
  partial?: boolean
  cancelled?: boolean
  message?: string
}

export const openKugouLoginWindow = async(owner: BrowserWindow | null): Promise<WebLoginResult> => {
  const cookieSession = session.fromPartition(KUGOU_LOGIN_PARTITION)

  const readCookie = async(): Promise<string> => {
    const cookies = await cookieSession.cookies.get({})
    const picked: string[] = []
    const seen = new Set<string>()
    cookies.forEach(cookie => {
      const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase()
      if (!(domain === 'kugou.com' || domain.endsWith('.kugou.com'))) return
      if (!cookie.value || seen.has(cookie.name)) return
      seen.add(cookie.name)
      picked.push(`${cookie.name}=${cookie.value}`)
    })
    return picked.join('; ')
  }

  const initialCookie = await readCookie()
  if (extractKugouAuth(initialCookie).playbackReady) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    let warmupStarted = false

    const loginWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: '酷狗音乐登录',
      backgroundColor: '#111111',
      webPreferences: {
        partition: KUGOU_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const finish = (result: WebLoginResult) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close()
      resolve(result)
    }

    const checkCookies = async() => {
      try {
        const cookie = await readCookie()
        if (extractKugouAuth(cookie).playbackReady) {
          void finish({ ok: true, cookie })
        } else if (extractKugouAuth(cookie).loggedIn && !warmupStarted) {
          warmupStarted = true
          setTimeout(() => {
            if (!settled && loginWindow && !loginWindow.isDestroyed()) {
              loginWindow.loadURL(KUGOU_LOGIN_WARMUP_URL).catch(() => {})
            }
          }, 900)
        }
      } catch (_) { /* 下轮重试 */ }
    }

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        loginWindow.loadURL(url).catch(() => {})
      } else {
        shell.openExternal(url).catch(() => {})
      }
      return { action: 'deny' }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies()
      loginWindow.webContents.executeJavaScript(AUTO_LOGIN_SCRIPT, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', () => { loginWindow.show() })
    loginWindow.on('closed', async() => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      try {
        const cookie = await readCookie()
        resolve(extractKugouAuth(cookie).playbackReady
          ? { ok: true, cookie }
          : (extractKugouAuth(cookie).loggedIn
              ? { ok: true, cookie, partial: true, message: '酷狗账号已登录，但播放 token 不完整，请稍后重试登录' }
              : { ok: false, cancelled: true, message: '酷狗登录窗口已关闭' }))
      } catch (e) {
        resolve({ ok: false, message: (e as Error).message || '酷狗登录窗口已关闭' })
      }
    })

    pollTimer = setInterval(checkCookies, 1200)
    loginWindow.loadURL(KUGOU_LOGIN_URL).catch(e => { finish({ ok: false, message: e.message }) })
  })
}
