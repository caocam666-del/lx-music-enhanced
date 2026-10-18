import { reactive } from '@common/utils/vueTools'

/**
 * Luminous Harmonic: 灵动岛播放进度的「本地时钟」。
 *
 * 为什么需要它：主窗只在特定时机推 played_time，而歌词窗原先只在开播时请求一次
 * get_status —— 于是进度是一个静态快照，进度条不动、时间标签永远是 0:00
 * （用户反馈「进度条是无效的」）。
 *
 * 做法与 core/lyric.ts 里逐字进度的本地时钟完全一致：
 *   基准时间 + (performance.now() - 基准时刻) × 播放倍速
 * 暂停时冻结，换行/seek/换歌时用主窗推来的真实位置重新对时（纠偏）。
 *
 * 单位约定：本 store 内一律使用「毫秒」，与主窗 `played_time` / `max_time` 一致。
 * （曾把毫秒当秒再乘 1000，导致时间标签显示成 416:40。）
 */

export const progress = reactive({
  /** 已播放毫秒 */
  now: 0,
  /** 总时长毫秒（0 表示未知） */
  max: 0,
  /** 0..1 */
  ratio: 0,
})

let baseTime = 0
let baseWall = 0
let rate = 1
let running = false
let frame = 0

/**
 * 跳转挂起（解决"点/拖进度条后弹回原地"）。
 *
 * 交互时序：用户拖动 → 本地立刻显示目标位置 → 主窗 seek 需要几十~几百毫秒才落地。
 * 这段时间里主窗仍可能推来**跳转前**的 played_time，若直接采纳，进度条就会
 * 弹回原位（用户反馈"怎么点都跳回原地"）。
 *
 * 所以跳转后先挂起：忽略明显滞后的上报，直到主窗上报的位置接近目标（说明 seek
 * 已落地）或超时兜底。只影响"看起来的位置"，不影响主窗真实播放。
 */
const SEEK_CONFIRM_TOLERANCE_MS = 1500
const SEEK_PENDING_TIMEOUT_MS = 3000
let pendingSeek = 0
let pendingSince = 0

/** 用户发起跳转：把显示位置直接定到目标并挂起纠偏 */
export const markSeek = (targetMs: number) => {
  if (!Number.isFinite(targetMs) || targetMs < 0) return
  pendingSeek = targetMs
  pendingSince = performance.now()
  baseTime = targetMs
  baseWall = performance.now()
  progress.now = targetMs
  if (progress.max > 0 && targetMs > progress.max) progress.max = targetMs
  recompute()
  ensureLoop()
}

const isSeekPending = () => pendingSeek > 0 && (performance.now() - pendingSince) < SEEK_PENDING_TIMEOUT_MS

const clearPendingSeek = () => {
  pendingSeek = 0
  pendingSince = 0
}

const recompute = () => {
  progress.ratio = progress.max > 0
    ? Math.max(0, Math.min(1, progress.now / progress.max))
    : 0
}

const tick = () => {
  frame = requestAnimationFrame(tick)
  if (!running) return
  progress.now = Math.max(0, baseTime + (performance.now() - baseWall) * rate)
  recompute()
}

const ensureLoop = () => {
  if (frame) return
  frame = requestAnimationFrame(tick)
}

/** 用主窗推来的真实毫秒位置对时；maxTime（毫秒）有值时才覆盖总时长 */
export const syncTime = (playedTime?: number, maxTime?: number) => {
  if (typeof maxTime == 'number' && Number.isFinite(maxTime) && maxTime > 0) progress.max = maxTime
  if (typeof playedTime == 'number' && Number.isFinite(playedTime)) {
    // 跳转挂起期间：忽略明显滞后的上报，避免进度条弹回跳转前的位置
    if (isSeekPending() && Math.abs(playedTime - pendingSeek) > SEEK_CONFIRM_TOLERANCE_MS) {
      recompute()
      return
    }
    clearPendingSeek()
    baseTime = Math.max(0, playedTime)
    baseWall = performance.now()
    progress.now = baseTime
  }
  recompute()
  ensureLoop()
}

export const setRunning = (value: boolean) => {
  if (running === value) return
  running = value
  if (value) {
    // 从暂停恢复：以当前进度为基准重新起算，避免暂停期间的时间被计入
    baseTime = progress.now
    baseWall = performance.now()
  } else {
    progress.now = Math.max(0, baseTime + (performance.now() - baseWall) * rate)
    recompute()
  }
  ensureLoop()
}

export const setRate = (value: number) => {
  const next = Number.isFinite(value) && value > 0 ? Number(value) : 1
  if (next === rate) return
  // 先按旧倍速结算到此刻，再换新倍速
  if (running) {
    progress.now = Math.max(0, baseTime + (performance.now() - baseWall) * rate)
    baseTime = progress.now
    baseWall = performance.now()
  }
  rate = next
  recompute()
}

export const reset = () => {
  running = false
  baseTime = 0
  baseWall = performance.now()
  progress.now = 0
  progress.max = 0
  progress.ratio = 0
  clearPendingSeek()
}

export const stopLoop = () => {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}
