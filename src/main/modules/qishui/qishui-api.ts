/**
 * 汽水音乐 API（主进程，导入歌单用子集）。
 * 请求设施与 Cookie 工具移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）
 * qishui-api.js，纯自用集成。职责：
 * - Cookie 规范化/登录态判断
 * - 用户歌单列表（创建 + 收藏）拉取
 * - 歌单内歌曲分页拉取
 * 仅用于读取用户自己的歌单数据；播放不走汽水接口（由应用内音源/换源解析）。
 */
import http from 'node:http'
import https from 'node:https'
import { getConfig } from './auth-config'

const QISHUI_WEB_PC_API_BASE = 'https://api.qishui.com'
const QISHUI_PC_APP_UA = 'LunaPC/3.5.1(408871041)'
// 公开实现（CharlesPikachu/musicdl）实测可用的稳定设备标识；优先使用登录流程保存的 deviceId/iid
const QISHUI_STABLE_DEVICE_ID = '3753066532709850'
const QISHUI_STABLE_IID = '3753066532713946'
const QISHUI_COOKIE_ATTRIBUTE_NAMES = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'])

// ---------- 基础工具 ----------

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

function pickObject(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return {}
}

function pickArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }
  return []
}

const firstUrl = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstUrl(item)
      if (url) return url
    }
    return ''
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return firstUrl(obj.url_list ?? obj.urls ?? obj.url ?? obj.uri ?? obj.main_url ?? obj.cover_url ?? obj.download_url)
  }
  return ''
}

// ---------- Cookie ----------

function collectQishuiCookiePair(picked: string[], key: string, value: unknown) {
  const text = String(value ?? '')
  if (!key || !text || /\s/.test(text)) return
  if (QISHUI_COOKIE_ATTRIBUTE_NAMES.has(key.toLowerCase())) return
  picked.push(`${key}=${text}`)
}

function collectQishuiCookieInput(input: unknown, picked: string[]) {
  if (!input) return
  if (typeof input === 'string') {
    String(input)
      .replace(/\r\n/g, ';')
      .split(';')
      .forEach(part => {
        const index = part.indexOf('=')
        if (index < 1) return
        collectQishuiCookiePair(picked, part.slice(0, index).trim(), part.slice(index + 1).trim())
      })
    return
  }
  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      input.forEach(item => { collectQishuiCookieInput(item, picked) })
      return
    }
    Object.keys(input as Record<string, unknown>).forEach(key => {
      collectQishuiCookiePair(picked, key, (input as Record<string, unknown>)[key])
    })
  }
}

export const normalizeQishuiCookieInput = (input: unknown): string => {
  const picked: string[] = []
  collectQishuiCookieInput(input, picked)
  return picked.join('; ')
}

export const qishuiCookieHasLogin = (cookieText: unknown): boolean =>
  /(?:^|;\s*)(sessionid|sessionid_ss|sid_guard|sid_tt|uid_tt|uid_tt_ss)=/i.test(String(cookieText || ''))

const qishuiCookieObject = (cookieText: unknown): Record<string, string> => {
  const obj: Record<string, string> = {}
  String(cookieText || '').split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index > 0) obj[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  })
  return obj
}

export const qishuiCookieUserId = (cookieText: unknown): string => {
  const obj = qishuiCookieObject(cookieText)
  return normalizeText(obj.uid_tt || obj.uid_tt_ss || obj.sessionid || obj.sid_tt || '')
}

// ---------- 请求 ----------

async function requestText(targetUrl: string, opts: {
  method?: string
  headers?: Record<string, string>
  timeoutMs?: number
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let u: URL
    try {
      u = new URL(targetUrl)
    } catch (err) {
      reject(err)
      return
    }
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, {
      method: opts.method ?? 'GET',
      headers: opts.headers ?? {},
    }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => { chunks.push(chunk as Buffer) })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (Number(response.statusCode) >= 400) {
          const err = new Error('HTTP ' + response.statusCode) as Error & { statusCode?: number, body?: string }
          err.statusCode = response.statusCode
          err.body = text
          reject(err)
          return
        }
        resolve(text)
      })
    })
    req.setTimeout(opts.timeoutMs ?? 9000, () => { req.destroy(new Error('Request timeout')) })
    req.on('error', reject)
    req.end()
  })
}

async function requestJson(targetUrl: string, opts?: Parameters<typeof requestText>[1]): Promise<Record<string, unknown>> {
  const text = await requestText(targetUrl, opts)
  try {
    return JSON.parse(text)
  } catch (e) {
    const err = new Error('Invalid JSON from Qishui API') as Error & { cause?: unknown, body?: string }
    err.cause = e
    err.body = text
    throw err
  }
}

function qishuiPcUrl(apiPath: string, params: Record<string, unknown>) {
  const u = new URL(QISHUI_WEB_PC_API_BASE + apiPath)
  Object.keys(params || {}).forEach(k => {
    if (params[k] != null) u.searchParams.set(k, String(params[k]))
  })
  return u.toString()
}

function qishuiPcAppParams(extra: Record<string, unknown> = {}): Record<string, unknown> {
  // 优先使用登录流程保存的稳定设备标识（会话与设备绑定，随机 device_id 会被过滤）
  let deviceId = QISHUI_STABLE_DEVICE_ID
  let iid = QISHUI_STABLE_IID
  try {
    const identity = getConfig()
    if (identity?.deviceId) deviceId = String(identity.deviceId)
    if (identity?.installId) iid = String(identity.installId)
  } catch (_) { /* ignore */ }
  return {
    aid: '386088',
    app_name: 'luna_pc',
    region: 'cn',
    geo_region: 'cn',
    os_region: 'cn',
    sim_region: '',
    device_id: deviceId,
    cdid: '',
    iid,
    version_name: '3.5.1',
    version_code: '30050100',
    channel: 'official',
    build_mode: 'master',
    network_carrier: '',
    ac: 'wifi',
    tz_name: 'Asia/Shanghai',
    resolution: '',
    device_platform: 'windows',
    device_type: 'Windows',
    os_version: 'Windows 11',
    fp: deviceId,
    ...extra,
  }
}

function qishuiWebHeaders(cookieText: string): Record<string, string> {
  const cookie = normalizeQishuiCookieInput(cookieText)
  const headers: Record<string, string> = {
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': QISHUI_PC_APP_UA,
    'x-luna-background-type': 'foreground',
    'x-luna-is-background-req': '0',
    'x-luna-is-local-user': '1',
  }
  if (cookie) headers.Cookie = cookie
  return headers
}

function qishuiPcStatusError(payload: unknown, fallback: string): (Error & { code?: number, body?: unknown }) | null {
  const p = payload as Record<string, any> | null
  const data = (p?.data) as Record<string, any> | undefined
  const code = Number((data && (data.error_code || data.err_code || data.code)) || (p && (p.error_code || p.err_code || p.code)) || 0)
  if (!code) return null
  const err = new Error(String((data && (data.description || data.message)) || (p && (p.description || p.message)) || fallback || 'QISHUI_API_ERROR')) as Error & { code?: number, body?: unknown }
  err.code = code
  err.body = payload
  return err
}

async function qishuiRequestJson(apiPath: string, params: Record<string, unknown>, cookieText: string): Promise<Record<string, unknown>> {
  const targetUrl = qishuiPcUrl(apiPath, params)
  const json = await requestJson(targetUrl, {
    timeoutMs: 10000,
    headers: qishuiWebHeaders(cookieText),
  })
  const err = qishuiPcStatusError(json, 'QISHUI_WEB_REQUEST_FAILED')
  if (err) throw err
  return json
}

// ---------- 歌单解析 ----------

export interface QishuiPlaylistInfo {
  id: string
  name: string
  cover: string
  trackCount: number
  isLiked: boolean
}

export interface QishuiTrackInfo {
  id: string
  name: string
  singer: string
  album: string
  interval: string
  cover: string
}

const qishuiPlaylistIdFromItem = (item: Record<string, any>): string => normalizeText(
  item.playlist_id || item.playlistId || item.collection_id || item.collectionId ||
  item.id || item.item_id || item.resource_id || item.object_id || item.server_id || '',
)

const qishuiPlaylistNameFromItem = (item: Record<string, any>): string => normalizeText(
  item.title || item.public_title || item.publicTitle || item.name || item.display_title ||
  item.display_name || item.playlist_name || item.collection_name || '',
)

const qishuiPlaylistCoverFromItem = (item: Record<string, any>): string => {
  // 实测 url_cover = { uri: 'tos-cn-.../xxx', urls: ['https://p3-luna.douyinpic.com/img/', ...], template_prefix }
  // 完整封面 URL = urls[0] + uri + '~c5_300x300.jpg'
  const coverObj = pickObject(item.url_cover, item.cover, item.cover_url) as Record<string, any>
  if (coverObj && typeof coverObj == 'object' && !Array.isArray(coverObj)) {
    const uri = normalizeText(coverObj.uri)
    const base = firstUrl(coverObj.urls ?? coverObj.url_list)
    if (uri && base) return base.replace(/\/?$/, '/') + uri + '~c5_300x300.jpg'
  }
  const raw = firstUrl(item.cover_url ?? item.cover ?? item.cover_uri ?? item.image ?? item.image_url ?? item.icon)
  if (!raw) return ''
  return raw.includes('~c5_') ? raw.replace(/~c5_[\w]+\.jpg/, '~c5_300x300.jpg') : raw
}

const qishuiPlaylistTrackCountFromItem = (item: Record<string, any>): number => Number(
  item.count_tracks || item.track_count || item.media_count || item.count || item.total || item.song_count || 0,
) || 0

const qishuiPlaylistLikeName = (name: string): boolean =>
  /喜欢|收藏|favorite|liked/i.test(String(name || ''))

const extractQishuiPlaylistCards = (payload: unknown): QishuiPlaylistInfo[] => {
  const data = ((payload as Record<string, any>) && (payload as Record<string, any>).data) || payload || {}
  const out: QishuiPlaylistInfo[] = []
  const seen = new Set<string>()
  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 6) return
    if (Array.isArray(node)) {
      node.forEach(item => { visit(item, depth + 1) })
      return
    }
    if (typeof node !== 'object') return
    const n = node as Record<string, any>
    const candidates = [n.playlist, n.playlist_info, n.collection, n.collect_playlist, n.fav_playlist, n.resource, n]
      .filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, any>>
    candidates.forEach(item => {
      const id = qishuiPlaylistIdFromItem(item)
      const name = qishuiPlaylistNameFromItem(item)
      const count = qishuiPlaylistTrackCountFromItem(item)
      const type = normalizeText(item.type || item.card_type || item.resource_type || n.type || '')
      if (!id || !name) return
      if (!count && !qishuiPlaylistLikeName(name) && !/playlist|collection|fav|songlist|歌单/i.test(type + ' ' + name)) return
      const key = id + '|' + name
      if (seen.has(key)) return
      seen.add(key)
      out.push({
        id,
        name,
        cover: qishuiPlaylistCoverFromItem(item),
        trackCount: count,
        isLiked: qishuiPlaylistLikeName(name),
      })
    })
    Object.keys(n).slice(0, 80).forEach(key => { visit(n[key], depth + 1) })
  }
  visit(data, 0)
  return out
}

const extractQishuiMediaList = (payload: unknown): unknown[] => {
  const data = ((payload as Record<string, any>) && (payload as Record<string, any>).data) || payload || {}
  const direct = pickArray(
    data.media_resources, data.media_list, data.related_media, data.medias, data.media,
    data.tracks, data.track_list, data.songs, data.items, data.list, data.result, data.song_list, data.recommend_media_list,
  )
  if (direct.length) return direct
  const candidates: unknown[] = []
  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 4) return
    if (Array.isArray(node)) {
      const mediaLike = node.filter(item => item && typeof item === 'object' &&
        ((item as Record<string, any>).media || (item as Record<string, any>).track_entity ||
          (item as Record<string, any>).entity || (item as Record<string, any>).base_info ||
          (item as Record<string, any>).id || (item as Record<string, any>).media_id))
      if (mediaLike.length > candidates.length) candidates.splice(0, candidates.length, ...mediaLike)
      node.forEach(item => { walk(item, depth + 1) })
    } else if (typeof node === 'object') {
      Object.keys(node as Record<string, unknown>).slice(0, 80).forEach(key => { walk((node as Record<string, unknown>)[key], depth + 1) })
    }
  }
  walk(data, 0)
  return candidates
}

const qishuiCoverFrom = (...candidates: unknown[]): string => {
  for (const item of candidates) {
    if (!item) continue
    if (typeof item == 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, any>
      const uri = normalizeText(obj.uri)
      const base = firstUrl(obj.urls ?? obj.url_list)
      if (uri && base) return base.replace(/\/?$/, '/') + uri + '~c5_375x375.jpg'
    }
    const raw = firstUrl(item)
    if (!raw) continue
    return raw.includes('~c5_') ? raw.replace(/~c5_[\w]+\.jpg/, '~c5_375x375.jpg') : raw
  }
  return ''
}

const mapQishuiTrack = (raw: unknown, fallbackKey: string): QishuiTrackInfo | null => {
  raw = raw || {}
  const r = raw as Record<string, any>
  const entity = pickObject(r.entity, r.data, r) as Record<string, any>
  const media = pickObject(entity.media, r.media, entity) as Record<string, any>
  const wrapper = pickObject(entity.track_wrapper, media.track_wrapper, r.track_wrapper) as Record<string, any>
  const track = pickObject(wrapper.track, media.track_entity, r.track_entity, media.track, r.track, media) as Record<string, any>
  const base = pickObject(track.base_info, media.base_info, r.base_info, track) as Record<string, any>
  const display = pickObject(track.display_info, media.display_info, r.display_info) as Record<string, any>
  const related = pickObject(track.related_info, media.related_info, r.related_info) as Record<string, any>
  const id = normalizeText(base.id || track.id || media.id || r.id || r.media_id || r.item_id || r.song_id || '')
  const name = normalizeText(base.name || base.title || track.name || track.title || media.name || r.name || r.title)
  if (!id || !name) return null
  const links = pickArray(related.artist_links, related.artists, base.artist_links, base.artists, display.artist_links, display.artists, track.artists, media.artists)
  const artistNames: string[] = []
  links.forEach(item => {
    const artistName = normalizeText(item && ((item as Record<string, any>).name || (item as Record<string, any>).display_name ||
      (item as Record<string, any>).simple_display_name || (item as Record<string, any>).title || (item as Record<string, any>).artist_name))
    if (artistName && !artistNames.includes(artistName)) artistNames.push(artistName)
  })
  const fallbackArtist = normalizeText(base.artist_name || display.artist_name || related.artist_name || track.artist_name || media.artist_name || base.author || r.author)
  if (!artistNames.length && fallbackArtist) {
    fallbackArtist.split(/\s*\/\s*|\s*,\s*|\s*&\s*/).forEach(name2 => {
      const part = normalizeText(name2)
      if (part) artistNames.push(part)
    })
  }
  const albumLink = pickObject(related.album_link, related.album, base.album, display.album, track.album, media.album) as Record<string, any>
  const album = normalizeText(albumLink.name || albumLink.title || base.album_name || display.album_name || '')
  const durationMs = Number(base.duration_ms || base.duration || track.duration_ms || track.duration || media.duration_ms || media.duration || r.duration || 0) || 0
  const durationSec = durationMs > 1000 ? Math.round(durationMs / 1000) : Math.round(durationMs)
  const interval = durationSec > 0
    ? `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`
    : ''
  const coverRaw = qishuiCoverFrom(display.cover_url, display.url_cover, base.cover_url, base.url_cover,
    albumLink.cover_url, albumLink.url_cover, track.url_cover, track.cover_url, media.cover_url, media.url_cover, r.cover_url, r.cover)
  return {
    id,
    name,
    singer: artistNames.join(' / ') || '未知歌手',
    album,
    interval,
    cover: coverRaw,
  }
}

const normalizeQishuiTracks = (rawItems: unknown[], seen: Set<string>): QishuiTrackInfo[] => {
  const out: QishuiTrackInfo[] = []
  rawItems.forEach(item => {
    const track = mapQishuiTrack(item, 'playlist')
    if (!track) return
    const key = track.id + '|' + track.name
    if (seen.has(key)) return
    seen.add(key)
    out.push(track)
  })
  return out
}

// ---------- 对外接口 ----------

export const getQishuiLibrary = async(cookieText: string): Promise<{
  userId: string
  nickname: string
  playlists: QishuiPlaylistInfo[]
}> => {
  const cookie = normalizeQishuiCookieInput(cookieText)
  if (!qishuiCookieHasLogin(cookie)) throw new Error('QISHUI_LOGIN_REQUIRED')

  // 用户信息（取 user_id）
  let userId = qishuiCookieUserId(cookie)
  let nickname = ''
  try {
    const meJson = await qishuiRequestJson('/luna/pc/me', qishuiPcAppParams(), cookie)
    const meData = ((meJson.data ?? meJson) as Record<string, any>) || {}
    // 实测 /luna/pc/me 的用户信息在 my_info 字段 (无 data 包裹)
    const user = pickObject(meData.my_info, meData.user, meData.profile, meData) as Record<string, any>
    nickname = normalizeText(user.nickname || user.nick_name || user.nickName || user.display_name || user.public_name || '')
    userId = normalizeText(user.id || user.user_id || user.userId || user.uid) || userId
  } catch (_) { /* me 失败时回退到 cookie 中的 uid */ }

  // 创建的歌单 + 收藏的歌单（收藏接口失败不阻塞）
  const playlists: QishuiPlaylistInfo[] = []
  const seen = new Set<string>()
  const mergeCards = (payload: unknown) => {
    extractQishuiPlaylistCards(payload).forEach(card => {
      const key = card.id + '|' + card.name
      if (seen.has(key)) return
      seen.add(key)
      playlists.push(card)
    })
  }
  if (userId) {
    const created = await qishuiRequestJson('/luna/pc/user/playlist', qishuiPcAppParams({
      user_id: userId,
      cursor: '',
      count: 50,
    }), cookie)
    mergeCards(created)
  }
  try {
    const collection = await qishuiRequestJson('/luna/pc/me/collection/mixed', qishuiPcAppParams({
      cursor: '',
      count: 50,
    }), cookie)
    mergeCards(collection)
  } catch (_) { /* 无收藏歌单时忽略 */ }

  if (!playlists.length) throw new Error('QISHUI_PLAYLIST_EMPTY')
  return { userId, nickname, playlists }
}

export const getQishuiPlaylistTracks = async(
  cookieText: string,
  playlistId: string,
  onProgress?: (count: number) => void,
): Promise<QishuiTrackInfo[]> => {
  const cookie = normalizeQishuiCookieInput(cookieText)
  if (!qishuiCookieHasLogin(cookie)) throw new Error('QISHUI_LOGIN_REQUIRED')
  const id = normalizeText(String(playlistId || '').replace(/^qishui:/i, ''))
  if (!id) throw new Error('QISHUI_PLAYLIST_ID_REQUIRED')

  const rawItems: unknown[] = []
  const seen = new Set<string>()
  let cursor = ''
  let hasMore = true
  let guard = 0
  while (hasMore && guard < 40) {
    guard += 1
    const json = await qishuiRequestJson('/luna/pc/playlist/detail', qishuiPcAppParams({
      playlist_id: id,
      cursor,
      count: 50,
    }), cookie)
    const pageItems = extractQishuiMediaList(json)
    rawItems.push(...pageItems)
    const data = ((json.data ?? json) as Record<string, any>) || {}
    const nextCursor = normalizeText(data.next_cursor ?? data.nextCursor ?? json.next_cursor ?? '')
    hasMore = !!(data.has_more || data.hasMore || json.has_more) && !!nextCursor
    cursor = nextCursor
    if (!pageItems.length) break
    if (onProgress) onProgress(normalizeQishuiTracks(rawItems, seen).length)
  }
  const tracks = normalizeQishuiTracks(rawItems, seen)
  if (!tracks.length) throw new Error('QISHUI_PLAYLIST_TRACKS_EMPTY')
  return tracks
}
