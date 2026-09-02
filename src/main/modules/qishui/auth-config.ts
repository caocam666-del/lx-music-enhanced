/**
 * 汽水音乐登录环境配置持久化（主进程）。
 * 保存 deviceId/installId/verifyPortraitId/computerName/msToken/cookie。
 * Cookie 仅作为扫码登录会话的中转，对外统一走 safeStorage 加密文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface QishuiAuthConfig {
  deviceId: string
  installId: string
  verifyPortraitId: string
  computerName: string
  cookie: string
  msToken: string
}

const configFile = () => path.join(global.lxDataPath, 'qishui-auth.json')

let cache: QishuiAuthConfig | null = null

const defaultConfig = (): QishuiAuthConfig => ({
  deviceId: '',
  installId: '',
  verifyPortraitId: '',
  computerName: os.hostname() || 'Windows-PC',
  cookie: '',
  msToken: '',
})

const readConfig = (): QishuiAuthConfig => {
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), 'utf8'))
    return Object.assign(defaultConfig(), raw && typeof raw === 'object' ? raw : {})
  } catch (_) {
    return defaultConfig()
  }
}

const getConfig = (): QishuiAuthConfig => {
  if (!cache) cache = readConfig()
  return { ...cache }
}

const updateConfig = (partial: Partial<QishuiAuthConfig>): QishuiAuthConfig => {
  const next = Object.assign(readConfig(), cache ?? {}, partial ?? {})
  cache = next
  try {
    fs.mkdirSync(path.dirname(configFile()), { recursive: true })
    fs.writeFileSync(configFile(), JSON.stringify(next, null, 2), 'utf8')
  } catch (_) { /* ignore */ }
  return getConfig()
}

const clearConfig = () => {
  cache = defaultConfig()
  try {
    if (fs.existsSync(configFile())) fs.unlinkSync(configFile())
  } catch (_) { /* ignore */ }
}

export {
  getConfig,
  updateConfig,
  clearConfig,
}
