/**
 * Wallpaper Engine 集成（主进程）：扫描列表 IPC + lx-we:// 媒体/封面协议。
 * 协议向渲染层提供本地壁纸文件流（video/preview），支持 Range（视频拖动）。
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { app, protocol } from 'electron'
import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import {
  previewPathForId,
  mediaPathForId,
  scanWallpaperEngineLibrary,
} from './wallpaper-engine-library'

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
}

const streamFile = async(filePath: string, request: Request): Promise<Response> => {
  return new Promise((resolve) => {
    try {
      if (!existsSync(filePath)) { resolve(new Response('not found', { status: 404 })); return }
      const stat = statSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
      const range = request.headers.get('range')
      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/)
        const start = match ? Number(match[1]) : 0
        const end = match?.[2] ? Number(match[2]) : stat.size - 1
        const stream = createReadStream(filePath, { start, end })
        stream.on('error', () => { try { resolve(new Response('read error', { status: 500 })) } catch (_) {} })
        resolve(new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
          },
        }))
      } else {
        const stream = createReadStream(filePath)
        stream.on('error', () => { try { resolve(new Response('read error', { status: 500 })) } catch (_) {} })
        resolve(new Response(stream as unknown as ReadableStream, {
          status: 200,
          headers: { 'Content-Type': mime, 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes' },
        }))
      }
    } catch (e) {
      resolve(new Response('error', { status: 500 }))
    }
  })
}

const handleLxWeRequest = async(request: Request): Promise<Response> => {
  const u = new URL(request.url)
  // lx-we://media/<id> | lx-we://preview/<id>
  const kind = u.hostname
  const id = u.pathname.replace(/^\/+/, '')
  const filePath = kind == 'media' ? mediaPathForId(id) : previewPathForId(id)
  if (!filePath || !existsSync(filePath)) return new Response('not found', { status: 404 })
  return streamFile(filePath, request)
}

// 在自定义 session 上注册协议处理器 (主窗口用 persist:win-main 分区)
export const handleLxWeOnSession = (ses: Electron.Session) => {
  try {
    ses.protocol.handle('lx-we', handleLxWeRequest)
  } catch (_) { /* 重复注册时忽略 */ }
}

export const registerWallpaperEngineScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'lx-we',
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true },
    },
  ])
}

let isInitialized = false
export default () => {
  if (isInitialized) return
  isInitialized = true

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.we_list, async() => {
    const list = await scanWallpaperEngineLibrary()
    return list.map(item => ({
      id: item.id,
      title: item.title,
      projectType: item.projectType,
      playable: !!item.mediaPath,
      previewUrl: item.previewPath ? `lx-we://preview/${item.id}` : '',
      mediaUrl: item.mediaPath ? `lx-we://media/${item.id}` : '',
    }))
  })

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  app.whenReady().then(() => {
    try {
      protocol.handle('lx-we', async(request) => {
        const u = new URL(request.url)
        // lx-we://media/<id> | lx-we://preview/<id>
        const kind = u.hostname
        const id = u.pathname.replace(/^\//, '')
        const filePath = kind == 'media' ? mediaPathForId(id) : previewPathForId(id)
        if (!filePath || !existsSync(filePath)) return new Response('not found', { status: 404 })
        return streamFile(filePath, request)
      })
    } catch (_) { /* 重复注册时忽略 */ }
  })
}
