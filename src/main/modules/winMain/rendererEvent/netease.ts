import { safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'node:path'
import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

const cookieFile = () => path.join(global.lxDataPath, 'netease-auth.bin')

export const normalizeNeteaseCookie = (value: unknown) => {
  if (typeof value != 'string') throw new Error('INVALID_COOKIE')
  const parts = value
    .replace(/^\s*cookie\s*:\s*/i, '')
    .replace(/[\r\n]+/g, ' ')
    .split(/[;\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
  const cookies = []
  for (const part of parts) {
    const index = part.indexOf('=')
    if (index < 1) continue
    const name = part.slice(0, index)
    const cookieValue = part.slice(index + 1)
    if (!/^[!#$%&'*+\-.^_`|~\da-zA-Z]+$/.test(name) || !cookieValue || /\s/.test(cookieValue)) continue
    cookies.push(`${name}=${cookieValue}`)
  }
  if (!cookies.some(cookie => cookie.startsWith('MUSIC_U='))) throw new Error('INVALID_COOKIE')
  return cookies.join('; ')
}

const readCookie = () => {
  if (!existsSync(cookieFile())) return null
  if (!safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_UNAVAILABLE')
  return safeStorage.decryptString(readFileSync(cookieFile()))
}

export default () => {
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.get_project_temp_path, async() => global.lxTempPath)
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.get_netease_cookie, async() => readCookie())
  mainHandle<string, undefined>(WIN_MAIN_RENDERER_EVENT_NAME.set_netease_cookie, async({ params }) => {
    const cookie = normalizeNeteaseCookie(params)
    if (!safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_UNAVAILABLE')
    writeFileSync(cookieFile(), safeStorage.encryptString(cookie), { mode: 0o600 })
    return undefined
  })
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.clear_netease_cookie, async() => {
    if (existsSync(cookieFile())) unlinkSync(cookieFile())
  })
}
