import path from 'node:path'
import { existsSync, mkdirSync, renameSync, readdirSync, statSync, rmSync } from 'fs'
import { app, shell, screen, nativeTheme, dialog, session } from 'electron'
import electronLog from 'electron-log/node'
import { URL_SCHEME_RXP } from '@common/constants'
import { getProxy, getTheme, initHotKey, initSetting, parseEnvParams } from './utils'
import { navigationUrlWhiteList } from '@common/config'
import defaultSetting from '@common/defaultSetting'
import { isExistWindow as isExistMainWindow, showWindow as showMainWindow } from './modules/winMain'
import { createAppEvent, createDislikeEvent, createListEvent } from '@main/event'
import { isMac, log } from '@common/utils'
import createWorkers from './worker'
import { migrateDBData } from './utils/migrate'
import { openDirInExplorer } from '@common/utils/electron'
import { setProxyByHost } from '@common/utils/request'

export const initGlobalData = () => {
  const envParams = parseEnvParams()
  // envParams.cmdParams.dt = !!envParams.cmdParams.dt

  global.envParams = {
    cmdParams: envParams.cmdParams,
    deeplink: envParams.deeplink,
  }
  global.lx = {
    inited: false,
    isSkipTrayQuit: false,
    // mainWindowClosed: true,
    event_app: createAppEvent(),
    event_list: createListEvent(),
    event_dislike: createDislikeEvent(),
    appSetting: defaultSetting,
    worker: createWorkers(),
    hotKey: {
      enable: true,
      config: {
        local: {
          enable: false,
          keys: {},
        },
        global: {
          enable: false,
          keys: {},
        },
      },
      state: new Map(),
    },
    theme: {
      shouldUseDarkColors: true, // Luminous Harmonic: 兜底默认值，app.whenReady 后由 listenerAppEvent 覆盖
      theme: {
        id: '',
        name: '',
        isDark: false,
        colors: {} as any,
      },
    },
    player_status: {
      status: 'stoped',
      name: '',
      singer: '',
      albumName: '',
      picUrl: '',
      progress: 0,
      duration: 0,
      playbackRate: 1,
      lyricLineText: '',
      lyricLineAllText: '',
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      collect: false,
      volume: 0,
      mute: false,
    },
  }

  global.staticPath =
    process.env.NODE_ENV !== 'production'
      ? webpackStaticPath
      : path.join(__dirname, 'static')
}

export const initSingleInstanceHandle = () => {
  // 单例应用程序
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
  }

  app.on('second-instance', (event, argv, cwd) => {
    if (isExistMainWindow()) {
      const envParams = parseEnvParams(argv)
      if (envParams.deeplink) {
        global.envParams.deeplink = envParams.deeplink
        global.lx.event_app.deeplink(global.envParams.deeplink)
        return
      }
      if (envParams.cmdParams.hidden !== true) {
        showMainWindow()
      }
    } else {
      app.quit()
    }
  })
}

export const applyElectronEnvParams = () => {
  // Is disable hardware acceleration
  if (global.envParams.cmdParams.dha) app.disableHardwareAcceleration()
  if (global.envParams.cmdParams.dhmkh) app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

  // fix linux transparent fail. https://github.com/electron/electron/issues/25153#issuecomment-843688494
  if (process.platform == 'linux') app.commandLine.appendSwitch('use-gl', 'desktop')

  // https://github.com/electron/electron/issues/22691
  app.commandLine.appendSwitch('wm-window-animations-disabled')

  app.commandLine.appendSwitch('--disable-gpu-sandbox')

  // proxy
  if (global.envParams.cmdParams['proxy-server']) {
    app.commandLine.appendSwitch('proxy-server', global.envParams.cmdParams['proxy-server'])
    app.commandLine.appendSwitch('proxy-bypass-list', global.envParams.cmdParams['proxy-bypass-list'] ?? '<local>')
  }
}

export const setUserDataPath = () => {
  // windows平台下如果应用目录下存在 portable 文件夹则将数据存在此文件下（原版行为）
  if (process.platform == 'win32') {
    const portablePath = path.join(path.dirname(app.getPath('exe')), '/portable')
    if (existsSync(portablePath)) {
      app.setPath('appData', portablePath)
      const appDataPath = path.join(portablePath, '/userData')
      if (!existsSync(appDataPath)) mkdirSync(appDataPath)
      app.setPath('userData', appDataPath)
    }
  }

  let userDataPath = app.getPath('userData')
  let tempPath = app.getPath('temp')

  // 仅开发模式把数据重定向到项目内独立目录（避免污染系统 %APPDATA%）
  // 打包版必须保持系统默认位置：覆盖安装后才能无缝沿用已装版本的设置/歌单等用户数据
  if (!app.isPackaged) {
    const appPath = app.getAppPath()
    const cwd = process.cwd()
    const executableDir = path.dirname(app.getPath('exe'))
    const projectRoot = existsSync(path.join(cwd, 'package.json'))
      ? cwd
      : existsSync(path.join(path.dirname(appPath), 'package.json'))
        ? path.dirname(appPath)
        : executableDir
    const dataPath = process.env.LX_MUSIC_DATA_PATH || path.join(projectRoot, 'data2')
    const appDataPath = path.join(dataPath, 'appData')
    userDataPath = path.join(dataPath, 'userData')
    const sessionDataPath = path.join(userDataPath, 'sessionData')
    const logsPath = path.join(dataPath, 'logs')
    const crashDumpsPath = path.join(dataPath, 'crashDumps')
    const cachePath = path.join(dataPath, 'cache')
    tempPath = path.join(dataPath, 'temp')

    for (const targetPath of [appDataPath, userDataPath, sessionDataPath, logsPath, crashDumpsPath, cachePath, tempPath]) {
      mkdirSync(targetPath, { recursive: true })
    }

    app.setPath('appData', appDataPath)
    app.setPath('userData', userDataPath)
    app.setPath('sessionData', sessionDataPath)
    app.setPath('logs', logsPath)
    app.setPath('crashDumps', crashDumpsPath)
    app.setPath('cache', cachePath)
    app.setPath('temp', tempPath)
    electronLog.transports.file.resolvePathFn = () => path.join(logsPath, 'main.log')
    process.env.TEMP = tempPath
    process.env.TMP = tempPath

    const expiry = Date.now() - 3 * 24 * 60 * 60 * 1000
    for (const name of readdirSync(tempPath)) {
      const targetPath = path.join(tempPath, name)
      try {
        if (statSync(targetPath).mtimeMs < expiry) rmSync(targetPath, { recursive: true, force: true })
      } catch {}
    }
  }

  global.lxOldDataPath = userDataPath
  global.lxDataPath = path.join(userDataPath, 'LxDatas')
  global.lxTempPath = tempPath
  mkdirSync(global.lxDataPath, { recursive: true })
}

export const registerDeeplink = (startApp: () => void) => {
  if (process.env.NODE_ENV !== 'production' && process.platform === 'win32') {
    // Set the path of electron.exe and your app.
    // These two additional parameters are only available on windows.
    // console.log(process.execPath, process.argv)
    app.setAsDefaultProtocolClient('lxmusic', process.execPath, process.argv.slice(1))
  } else {
    app.setAsDefaultProtocolClient('lxmusic')
  }

  // deep link
  app.on('open-url', (event, url) => {
    if (!URL_SCHEME_RXP.test(url)) return
    event.preventDefault()
    global.envParams.deeplink = url
    if (isExistMainWindow()) {
      if (global.envParams.deeplink) global.lx.event_app.deeplink(global.envParams.deeplink)
      else showMainWindow()
    } else {
      startApp()
    }
  })
}

export const listenerAppEvent = (startApp: () => void) => {
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('navigation to url:', navigationUrl.length > 130 ? navigationUrl.substring(0, 130) + '...' : navigationUrl)
        return
      }
      if (!navigationUrlWhiteList.some(url => url.test(navigationUrl))) {
        event.preventDefault()
        return
      }
      console.log('navigation to url:', navigationUrl)
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (!/^devtools/.test(url) && /^https?:\/\//.test(url)) {
        void shell.openExternal(url)
      }
      console.log(url)
      return { action: 'deny' }
    })
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Strip away preload scripts if unused or verify their location is legitimate
      delete webPreferences.preload
      // delete webPreferences.preloadURL

      // Disable Node.js integration
      webPreferences.nodeIntegration = false

      // Verify URL being loaded
      if (!navigationUrlWhiteList.some(url => url.test(params.src))) {
        event.preventDefault()
      }
    })

    // disable create dictionary
    // https://github.com/lyswhut/lx-music-desktop/issues/773
    contents.session.setSpellCheckerDictionaryDownloadURL('http://0.0.0.0')
  })

  app.on('activate', () => {
    if (isExistMainWindow()) {
      showMainWindow()
    } else {
      startApp()
    }
  })

  app.on('before-quit', () => {
    global.lx.isSkipTrayQuit = true
    // Luminous Harmonic: 退出保险 — 若有泄漏句柄 (如 lx-we:// 壁纸视频流) 阻塞正常退出,
    // 残留的僵尸进程会持有单实例锁, 表现为"关闭软件后再也打不开"。5s 后强制退出兜底。
    const forceExit = setTimeout(() => app.exit(0), 5000)
    forceExit.unref?.()
  })
  app.on('window-all-closed', () => {
    if (isMac) return

    app.quit()
  })

  const initScreenParams = () => {
    global.envParams.workAreaSize = screen.getPrimaryDisplay().workAreaSize
  }
  app.on('ready', () => {
    screen.on('display-metrics-changed', initScreenParams)
    initScreenParams()
  })

  nativeTheme.addListener('updated', () => {
    const shouldUseDarkColors = nativeTheme.shouldUseDarkColors
    if (shouldUseDarkColors == global.lx.theme.shouldUseDarkColors) return
    global.lx.theme.shouldUseDarkColors = shouldUseDarkColors
    global.lx?.event_app.system_theme_change(shouldUseDarkColors)
  })

  const setProxy = () => {
    const proxy = getProxy()
    if (proxy) {
      setProxyByHost(proxy.host, proxy.port ? String(proxy.port) : undefined)
    } else setProxyByHost()
    // Luminous Harmonic: 同步 Chromium 会话代理 — 否则 <img> 等渲染层请求跟随系统代理,
    // 系统代理 (如 Clash) 会挂起国内图片 CDN 请求, 导致列表封面加载不出
    setSessionProxy(proxy)
  }

  // Luminous Harmonic: 渲染会话代理与应用代理设置保持一致 (无应用代理时直连, 不跟系统代理)
  const setSessionProxy = (proxy: ReturnType<typeof getProxy>) => {
    if (proxy) {
      void session.defaultSession.setProxy({ proxyRules: `http://${proxy.host}:${proxy.port ?? 80}` })
    } else {
      void session.defaultSession.setProxy({ mode: 'direct' })
    }
  }
  global.lx.event_app.on('updated_config', (keys, setting) => {
    if (keys.includes('network.proxy.enable') || (global.lx.appSetting['network.proxy.enable'] && keys.some(k => k.includes('network.proxy.')))) {
      setProxy()
    }

    if (keys.includes('player.volume')) {
      global.lx.event_app.player_status({ volume: Math.trunc(setting['player.volume']! * 100) })
    }
    if (keys.includes('player.isMute')) {
      global.lx.event_app.player_status({ mute: setting['player.isMute'] })
    }
  })
  global.lx.event_app.on('app_inited', () => {
    setProxy()
  })
}

const initTheme = () => {
  global.lx.theme = getTheme()
  const themeConfigKeys = ['theme.id', 'theme.lightId', 'theme.darkId']
  global.lx.event_app.on('updated_config', (keys) => {
    let requireUpdate = false
    for (const key of keys) {
      if (themeConfigKeys.includes(key)) {
        requireUpdate = true
        break
      }
    }
    if (requireUpdate) {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
  global.lx.event_app.on('system_theme_change', () => {
    if (global.lx.appSetting['theme.id'] == 'auto') {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
}

const backupDB = (backupPath: string) => {
  const dbPath = path.join(global.lxDataPath, 'lx.data.db')
  try {
    renameSync(dbPath, backupPath)
  } catch {}
  try {
    renameSync(`${dbPath}-wal`, `${backupPath}-wal`)
  } catch {}
  try {
    renameSync(`${dbPath}-shm`, `${backupPath}-shm`)
  } catch {}
  openDirInExplorer(backupPath)
}

let isInitialized = false
export const initAppSetting = async() => {
  if (!global.lx.inited) {
    const config = await initHotKey()
    global.lx.hotKey.config.local = config.local
    global.lx.hotKey.config.global = config.global
    global.lx.inited = true
  }

  if (!isInitialized) {
    let dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
    if (dbFileExists === null) {
      const backupPath = path.join(global.lxDataPath, `lx.data.db.${Date.now()}.bak`)
      dialog.showMessageBoxSync({
        type: 'warning',
        message: 'Database verify failed',
        detail: `数据库表结构校验失败，我们将把有问题的数据库备份到：${backupPath}\n若此问题导致你的数据丢失，你可以尝试从备份文件找回它们。\n\nThe database table structure verification failed, we will back up the problematic database to: ${backupPath}\nIf this problem causes your data to be lost, you can try to retrieve them from the backup file.`,
      })
      backupDB(backupPath)
      dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
    }
    global.lx.appSetting = (await initSetting()).setting
    if (!dbFileExists) await migrateDBData().catch(err => { log.error(err) })
    initTheme()
    if (envParams.cmdParams.dt == null) envParams.cmdParams.dt = !global.lx.appSetting['common.transparentWindow']
  }
  // global.lx.theme = getTheme()

  isInitialized ||= true
}

export const quitApp = () => {
  global.lx.isSkipTrayQuit = true
  app.quit()
}
