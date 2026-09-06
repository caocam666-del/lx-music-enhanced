/**
 * Wallpaper Engine 壁纸库扫描（主进程）。
 * 发现/扫描逻辑移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）
 * desktop/wallpaper-engine-library.js，纯自用集成，精简版：
 * - Steam 库发现：注册表 → libraryfolders.vdf → 候选路径兜底
 * - 扫描 workshop/content/431960 与 wallpaper_engine/projects/myprojects
 * - 解析 project.json（只读元数据），提取标题/类型/封面
 * - 媒体/封面通过 lx-we:// 自定义协议提供给渲染层
 * scene(原生引擎) 与 web 类型不执行内容，仅显示静态封面（安全预览）。
 */
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const WALLPAPER_ENGINE_APP_ID = '431960'
const MAX_PROJECT_JSON_BYTES = 1024 * 1024
const SAFE_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']
const SAFE_VIDEO_EXT = ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v']

export interface WEWallpaper {
  id: string
  title: string
  projectType: string // video | image | scene | web | application | unknown
  mediaPath: string // video/image 的主文件绝对路径（空串表示不可直接播放）
  previewPath: string // 封面绝对路径
  dir: string
}

const idFor = (p: string) => crypto.createHash('sha256').update(p).digest('hex').slice(0, 24)

// ---------- Steam 库发现 ----------

const registryQueryCandidates = [
  ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
  ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
]

async function readRegistryString(key: string, valueName: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', key, '/v', valueName], { timeout: 5000 })
    const match = stdout.match(new RegExp(`${valueName}\\s+REG_\\S+\\s+(.+)`, 'i'))
    return match ? match[1].trim() : ''
  } catch (_) {
    return ''
  }
}

function readSteamLibraryFolders(steamRoot: string): string[] {
  const out: string[] = []
  const candidates = [
    path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamRoot, 'config', 'libraryfolders.vdf'),
  ]
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, 'utf8')
      for (const match of text.matchAll(/"path"\s+"([^"]+)"/gi)) {
        out.push(match[1].replace(/\\\\/g, '\\'))
      }
    } catch (_) { /* 忽略单个文件读取失败 */ }
  }
  return out
}

function candidateRoots(): string[] {
  const out = [
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Steam') : '',
    'C:\\Program Files (x86)\\Steam',
    'D:\\Steam', 'D:\\SteamLibrary',
    'E:\\Steam', 'E:\\SteamLibrary',
    'F:\\Steam', 'F:\\SteamLibrary',
  ].filter(Boolean)
  return out
}

export const discoverSteamLibraries = async(): Promise<string[]> => {
  const roots = new Set<string>()
  for (const [key, valueName] of registryQueryCandidates) {
    const p = await readRegistryString(key, valueName)
    if (p) roots.add(p.replace(/\//g, '\\'))
  }
  for (const root of [...roots]) {
    readSteamLibraryFolders(root).forEach(p => { roots.add(p) })
  }
  candidateRoots().forEach(p => { roots.add(p) })
  return [...roots].filter(root => {
    try { return fs.existsSync(root) } catch (_) { return false }
  })
}

export const discoverWEContainers = async(): Promise<string[]> => {
  const libraries = await discoverSteamLibraries()
  const containers = new Set<string>()
  for (const lib of libraries) {
    containers.add(path.join(lib, 'steamapps', 'workshop', 'content', WALLPAPER_ENGINE_APP_ID))
    containers.add(path.join(lib, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects'))
  }
  return [...containers].filter(dir => {
    try { return fs.statSync(dir).isDirectory() } catch (_) { return false }
  })
}

// ---------- project.json 解析 ----------

interface ProjectManifest {
  title?: string
  type?: string
  file?: string
  preview?: string
  cover?: string
  general?: Record<string, unknown>
}

const readProjectManifest = (projectJsonPath: string): ProjectManifest | null => {
  try {
    const stat = fs.statSync(projectJsonPath)
    if (!stat.isFile() || stat.size > MAX_PROJECT_JSON_BYTES) return null
    const text = fs.readFileSync(projectJsonPath, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(text)
  } catch (_) {
    return null
  }
}

const firstExistingFile = (dir: string, names: string[], exts: string[]): string => {
  for (const name of names) {
    if (!name) continue
    const resolved = path.resolve(dir, name)
    if (!resolved.toLowerCase().startsWith(dir.toLowerCase())) continue // 防路径逃逸
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved
    } catch (_) { /* ignore */ }
  }
  for (const ext of exts) {
    const guess = path.join(dir, ext.slice(1) + ext)
    void guess
  }
  // 按扩展名在目录内找同名基础文件 (preview.jpg / preview.png ...)
  for (const name of names) {
    if (!name) continue
    for (const ext of exts) {
      const base = name.replace(/\.[^.]+$/, '')
      const candidate = path.resolve(dir, base + ext)
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
      } catch (_) { /* ignore */ }
    }
  }
  return ''
}

const mediaExtFor = (file: string): string => {
  const ext = path.extname(file).toLowerCase()
  if (SAFE_VIDEO_EXT.includes(ext)) return 'video'
  if (SAFE_IMAGE_EXT.includes(ext)) return 'image'
  return ''
}

const indexProject = (projectDir: string): WEWallpaper | null => {
  const manifestPath = path.join(projectDir, 'project.json')
  const manifest = readProjectManifest(manifestPath)
  if (!manifest) return null
  const projectType = String(manifest.type ?? 'unknown').toLowerCase()
  let mediaPath = ''
  if (projectType == 'video' || projectType == 'image') {
    const file = manifest.file ? path.resolve(projectDir, manifest.file) : ''
    try {
      if (file && file.toLowerCase().startsWith(projectDir.toLowerCase()) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        mediaPath = mediaExtFor(file) ? file : ''
      }
    } catch (_) { /* ignore */ }
  }
  // 封面: project.preview/cover 优先, 然后 preview.jpg 等惯例文件
  let previewPath = firstExistingFile(projectDir, [manifest.preview ?? '', manifest.cover ?? ''], SAFE_IMAGE_EXT)
  if (!previewPath) previewPath = firstExistingFile(projectDir, ['preview.jpg', 'cover.jpg'], SAFE_IMAGE_EXT)
  const title = String(manifest.title ?? path.basename(projectDir)).trim().slice(0, 160) || path.basename(projectDir)
  return {
    id: idFor(projectDir),
    title,
    projectType,
    mediaPath,
    previewPath,
    dir: projectDir,
  }
}

// ---------- 扫描 ----------

let scanCache: { at: number, list: WEWallpaper[] } | null = null
const CACHE_TTL = 30_000
export const mediaPathForId = (id: string): string | null => {
  const item = (scanCache?.list ?? []).find(item2 => item2.id == id)
  return item ? (item.mediaPath || item.previewPath || null) : null
}
export const previewPathForId = (id: string): string | null => {
  const item = (scanCache?.list ?? []).find(item2 => item2.id == id)
  return item ? (item.previewPath || null) : null
}

export const scanWallpaperEngineLibrary = async(force = false): Promise<WEWallpaper[]> => {
  if (!force && scanCache && Date.now() - scanCache.at < CACHE_TTL) return scanCache.list
  const containers = await discoverWEContainers()
  const list: WEWallpaper[] = []
  const seen = new Set<string>()
  for (const container of containers) {
    let entries: string[] = []
    try { entries = fs.readdirSync(container) } catch (_) { continue }
    for (const entry of entries) {
      const projectDir = path.join(container, entry)
      try {
        if (!fs.statSync(projectDir).isDirectory()) continue
      } catch (_) { continue }
      const item = indexProject(projectDir)
      if (!item?.title) continue
      if (seen.has(item.id)) continue
      seen.add(item.id)
      // 标准化标题去重 (同一壁纸可能出现在多个 Steam 库/容器中)
      const normTitle = item.title.toLowerCase().replace(/s+/g, ' ').trim()
      if (seen.has('t:' + normTitle)) continue
      seen.add('t:' + normTitle)
      list.push(item)
    }
  }
  // 可直接播放(视频/图片)优先, 其余(场景/web 仅预览)在后, 组内按标题
  list.sort((a, b) => {
    const aPlayable = a.mediaPath && a.projectType != 'scene' ? 0 : 1
    const bPlayable = b.mediaPath && b.projectType != 'scene' ? 0 : 1
    if (aPlayable != bPlayable) return aPlayable - bPlayable
    return a.title.localeCompare(b.title, 'zh-CN')
  })
  // eslint-disable-next-line require-atomic-updates
  scanCache = { at: Date.now(), list }
  return list
}
