/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-floating-promises, @typescript-eslint/await-thenable, @typescript-eslint/prefer-nullish-coalescing, require-atomic-updates, promise/param-names -- BrowserWindow 事件驱动登录流程, 轮询/回调中的 promise 用法为该模式固有形态 (移植自 Mineradio GPL-3.0) */
/**
 * QQ 音乐官方网页登录窗口（扫码登录）。
 * 移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）desktop/main.js 的
 * openQQMusicLoginWindow，纯自用集成。
 * 流程：打开 y.qq.com 官方窗口（页面自带二维码/账号登录）→ 自动点击"登录" →
 * 轮询会话 Cookie；通用登录态出现后打开隐藏预热页换取 qm_keyst 播放票据；
 * 播放票据就绪（uin+qm_keyst）后回传 Cookie 字符串。
 */
import { BrowserWindow, session, shell } from 'electron'
import { extractQQAuth, normalizeQQCookieInput } from './qq-api'

const QQ_LOGIN_PARTITION = 'persist:lx-qqmusic-login'
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile'
const QQ_LOGIN_FALLBACK_URL = 'https://y.qq.com/'
const QQ_WARMUP_URL = 'https://y.qq.com/n/ryqq/player'

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

const TRUSTED_QQ_DOMAINS = ['qq.com', 'tencent.com', 'qqmusic.com', 'gtimg.com', 'qpic.cn', 'weixin.qq.com']

const isTrustedQQLoginUrl = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(String(targetUrl || ''))
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    return TRUSTED_QQ_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))
  } catch (_) {
    return false
  }
}

// 域名权重: y.qq.com / qqmusic.qq.com 的票据最可信 (Mineradio 同款评分思路)
const qqCookieScore = (cookie: Electron.Cookie): number => {
  const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase()
  const pathName = String(cookie.path || '/')
  let score = 0
  if (domain === 'y.qq.com' || domain.endsWith('.y.qq.com')) score += 400
  else if (domain === 'qqmusic.qq.com' || domain.endsWith('.qqmusic.qq.com')) score += 360
  else if (domain === 'qq.com') score += 240
  else if (domain.endsWith('.qq.com')) score += 160
  if (pathName === '/') score += 40
  if (cookie.secure) score += 10
  if (cookie.hostOnly) score += 5
  const expires = Number(cookie.expirationDate)
  if (Number.isFinite(expires) && expires > Date.now() / 1000) score += Math.min(20, Math.floor((expires - Date.now() / 1000) / 86400))
  return score
}

const PRIORITY_NAMES = ['uin', 'qqmusic_uin', 'wxuin', 'qm_keyst', 'qqmusic_key', 'music_key', 'wxopenid', 'login_type']

const buildQQCookieHeader = (cookies: Electron.Cookie[]): string => {
  const picked = new Map<string, { value: string, score: number, expirationDate: number }>()
  const nowSeconds = Date.now() / 1000
  cookies.forEach(cookie => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase()
    const allowed = domain === 'qq.com' || domain.endsWith('.qq.com') || domain.endsWith('qqmusic.qq.com')
    if (!cookie?.name || !allowed || !cookie.value) return
    if (Number.isFinite(Number(cookie.expirationDate)) && Number(cookie.expirationDate) > 0 && Number(cookie.expirationDate) <= nowSeconds) return
    const score = qqCookieScore(cookie)
    const previous = picked.get(cookie.name)
    const expirationDate = Number(cookie.expirationDate) || 0
    if (!previous || score > previous.score || (score == previous.score && expirationDate > previous.expirationDate)) {
      picked.set(cookie.name, { value: cookie.value, score, expirationDate })
    }
  })
  const ordered: string[] = []
  PRIORITY_NAMES.forEach(name => {
    const entry = picked.get(name)
    if (entry) {
      ordered.push(`${name}=${entry.value}`)
      picked.delete(name)
    }
  })
  picked.forEach((entry, name) => { ordered.push(`${name}=${entry.value}`) })
  return ordered.join('; ')
}

export interface WebLoginResult {
  ok: boolean
  cookie?: string
  partial?: boolean
  cancelled?: boolean
  message?: string
}

export const openQQLoginWindow = async(owner: BrowserWindow | null): Promise<WebLoginResult> => {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION)

  const readCookie = async(): Promise<string> => {
    const cookies = await cookieSession.cookies.get({})
    return buildQQCookieHeader(cookies)
  }

  const hasPlayback = (cookieText: string): boolean => extractQQAuth(cookieText).playbackReady
  const hasLogin = (cookieText: string): boolean => extractQQAuth(cookieText).loggedIn

  const initialCookie = await readCookie()
  if (hasPlayback(initialCookie)) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    let warmupTimer: NodeJS.Timeout | null = null
    let warmupWindow: BrowserWindow | null = null
    let playbackFinalizePending = false
    let showWatchdog: NodeJS.Timeout | null = null
    const popupWindows = new Set<BrowserWindow>()

    const loginWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: 'QQ 音乐登录',
      backgroundColor: '#111111',
      webPreferences: {
        partition: QQ_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const closeAuxiliaryWindows = () => {
      if (showWatchdog) { clearTimeout(showWatchdog); showWatchdog = null }
      if (warmupTimer) { clearTimeout(warmupTimer); warmupTimer = null }
      const windows = Array.from(popupWindows)
      popupWindows.clear()
      if (warmupWindow) windows.push(warmupWindow)
      warmupWindow = null
      windows.forEach(win => {
        try {
          if (win && !win.isDestroyed()) win.close()
        } catch (_) { /* ignore */ }
      })
    }

    const finish = async(result: WebLoginResult) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      closeAuxiliaryWindows()
      try { await cookieSession.flushStorageData() } catch (_) { /* ignore */ }
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close()
      resolve(result)
    }

    const showLoginWindow = () => {
      if (settled || !loginWindow || loginWindow.isDestroyed() || loginWindow.isVisible()) return
      loginWindow.show()
      loginWindow.focus()
    }

    // 通用 QQ 登录完成后, 官方回调需要时间换取 qm_keyst 播放票据;
    // 隐藏预热页在独立 WebContents 里触发该交换, 不会覆盖登录回调
    const schedulePlaybackWarmup = () => {
      if (settled || warmupTimer || warmupWindow) return
      warmupTimer = setTimeout(() => {
        warmupTimer = null
        if (settled || !loginWindow || loginWindow.isDestroyed()) return
        warmupWindow = new BrowserWindow({
          width: 720,
          height: 520,
          parent: loginWindow,
          modal: false,
          show: false,
          autoHideMenuBar: true,
          backgroundColor: '#111111',
          webPreferences: {
            partition: QQ_LOGIN_PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })
        warmupWindow.on('closed', () => { warmupWindow = null })
        warmupWindow.webContents.on('did-finish-load', () => { void checkCookies() })
        warmupWindow.loadURL(QQ_WARMUP_URL).catch(() => {})
      }, 5000)
    }

    const checkCookies = async() => {
      try {
        const cookie = await readCookie()
        if (hasPlayback(cookie)) {
          if (playbackFinalizePending) return
          playbackFinalizePending = true
          // 播放票据与资料 cookie 在短时间内连续写入, 保留官方回调一次最终读取
          await new Promise(resolveDelay => setTimeout(resolveDelay, 450))
          const finalizedCookie = await readCookie()
          void finish({ ok: true, cookie: hasPlayback(finalizedCookie) ? finalizedCookie : cookie })
        } else if (hasLogin(cookie)) {
          schedulePlaybackWarmup()
        }
      } catch (_) {
        if (!settled) playbackFinalizePending = false
      }
    }

    const installWindowHandlers = (win: BrowserWindow, isRoot: boolean) => {
      if (!win || win.isDestroyed()) return
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (isTrustedQQLoginUrl(url)) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: 760,
              height: 640,
              parent: loginWindow,
              modal: false,
              show: true,
              autoHideMenuBar: true,
              backgroundColor: '#111111',
              webPreferences: {
                partition: QQ_LOGIN_PARTITION,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
          }
        }
        if (/^https?:\/\//i.test(String(url || ''))) {
          shell.openExternal(url).catch(() => {})
        }
        return { action: 'deny' }
      })
      win.webContents.on('did-create-window', child => {
        popupWindows.add(child)
        child.on('closed', () => popupWindows.delete(child))
        installWindowHandlers(child as BrowserWindow, false)
      })
      if (!isRoot) win.webContents.on('did-finish-load', () => { void checkCookies() })
    }
    installWindowHandlers(loginWindow, true)

    loginWindow.webContents.on('did-finish-load', () => {
      void checkCookies()
      showLoginWindow()
      loginWindow.webContents.executeJavaScript(AUTO_LOGIN_SCRIPT, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', showLoginWindow)
    loginWindow.on('closed', async() => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      closeAuxiliaryWindows()
      try {
        const cookie = await readCookie()
        try { await cookieSession.flushStorageData() } catch (_) { /* ignore */ }
        if (hasPlayback(cookie)) {
          resolve({ ok: true, cookie })
        } else if (hasLogin(cookie)) {
          resolve({
            ok: false,
            partial: true,
            message: 'QQ 账号验证已完成，但 QQ 音乐播放授权尚未生成，请在官方登录窗口完成授权后再关闭',
          })
        } else {
          resolve({ ok: false, cancelled: true, message: 'QQ 登录窗口已关闭' })
        }
      } catch (e) {
        resolve({ ok: false, message: (e as Error).message || 'QQ 登录窗口已关闭' })
      }
    })

    pollTimer = setInterval(checkCookies, 1200)
    showWatchdog = setTimeout(showLoginWindow, 2500)
    loginWindow.loadURL(QQ_LOGIN_URL).catch(async(e) => {
      // 官方入口加载失败 → 回退官方主页
      try {
        await cookieSession.clearCache()
      } catch (_) { /* ignore */ }
      loginWindow.loadURL(QQ_LOGIN_FALLBACK_URL).catch(() => { finish({ ok: false, message: e.message }) })
    })
  })
}

// 归一化导出（与 qq-api 保持一致）
export { normalizeQQCookieInput }
