import { reactive, ref } from '@common/utils/vueTools'

/**
 * Luminous Harmonic: 播放失败诊断。
 *
 * 背景：此前播放失败只写一行状态文本（"歌曲链接获取中..." / "所有音源均无法播放"），
 * 用户无法知道「试过哪些音源、各自错在哪、各花了多久」，排障只能靠翻 DevTools。
 *
 * 这里记录一轮取 URL / 换源的全部尝试，供播放栏的诊断浮层展示与一键复制。
 * 设计要点：
 *   - 只保留最近 N 条，避免长播单下无限增长
 *   - 全部为纯数据，浮层只做渲染，便于将来导出/上报
 */

export interface SourceAttempt {
  /** 自增序号 */
  seq: number
  /** 音源 id，如 wy / tx / kw */
  source: string
  /** 展示用名称（能找到就填） */
  sourceName?: string
  /** 结果 */
  result: 'ok' | 'cache' | 'fail' | 'timeout' | 'skip'
  /** 该次尝试耗时（毫秒） */
  ms: number
  /** 该次尝试的时限（毫秒） */
  limit?: number
  /** 失败原因 */
  message?: string
  /** 音质 */
  quality?: string
}

export interface PlayDiagnosis {
  /** 本次诊断对应的歌曲 id */
  musicId: string | null
  /** 歌名 - 歌手（便于复制出来一眼看懂） */
  title: string
  /** 开始时间戳 */
  startedAt: number
  /** 结束时间戳（0 = 仍在进行） */
  endedAt: number
  /** 最终判定 */
  verdict: '' | 'ok' | 'exhausted' | 'transient' | 'audio-failed'
  /** 判定说明 */
  verdictText: string
  /** 尝试明细 */
  attempts: SourceAttempt[]
}

const MAX_ATTEMPTS = 24

export const diagnosis = reactive<PlayDiagnosis>({
  musicId: null,
  title: '',
  startedAt: 0,
  endedAt: 0,
  verdict: '',
  verdictText: '',
  attempts: [],
})

let seq = 0

/** 开始一轮新的诊断（切歌 / 手动重试时调用） */
export const beginDiagnosis = (musicId: string | null, title = '') => {
  seq = 0
  diagnosis.musicId = musicId
  diagnosis.title = title
  diagnosis.startedAt = Date.now()
  diagnosis.endedAt = 0
  diagnosis.verdict = ''
  diagnosis.verdictText = ''
  diagnosis.attempts = []
}

/** 记录一次音源尝试 */
export const recordAttempt = (attempt: Omit<SourceAttempt, 'seq'>) => {
  if (!diagnosis.startedAt) diagnosis.startedAt = Date.now()
  diagnosis.attempts.push({ seq: ++seq, ...attempt })
  if (diagnosis.attempts.length > MAX_ATTEMPTS) {
    diagnosis.attempts.splice(0, diagnosis.attempts.length - MAX_ATTEMPTS)
  }
}

/** 结束一轮诊断 */
export const endDiagnosis = (verdict: PlayDiagnosis['verdict'], verdictText: string) => {
  diagnosis.endedAt = Date.now()
  diagnosis.verdict = verdict
  diagnosis.verdictText = verdictText
}

export const clearDiagnosis = () => {
  beginDiagnosis(null, '')
}

/** 浮层是否已打开（放在 store 里，方便快捷键/其它组件打开） */
export const isShowDiagnosis = ref(false)

/** 一行式摘要，用于状态区域 hover 提示 */
export const getDiagnosisSummary = (): string => {
  if (!diagnosis.attempts.length) return diagnosis.verdictText || '暂无诊断信息'
  const ok = diagnosis.attempts.find(a => a.result == 'ok' || a.result == 'cache')
  const total = diagnosis.endedAt ? diagnosis.endedAt - diagnosis.startedAt : Date.now() - diagnosis.startedAt
  return ok
    ? `已由 ${ok.source} 取得链接（用时 ${total}ms）`
    : `尝试 ${diagnosis.attempts.length} 个音源均失败，共耗时 ${total}ms`
}

/** 纯文本报告，供「复制诊断信息」按钮使用 */
export const buildDiagnosisReport = (): string => {
  const d = diagnosis
  const lines: string[] = []
  const fmt = (ms: number) => `${ms}ms`
  const total = d.endedAt ? d.endedAt - d.startedAt : Date.now() - d.startedAt
  lines.push('=== LX Music 播放诊断 ===')
  lines.push(`歌曲: ${d.title || '(未知)'}  [${d.musicId ?? '-'}]`)
  lines.push(`开始: ${d.startedAt ? new Date(d.startedAt).toLocaleString() : '-'}`)
  lines.push(`总耗时: ${fmt(total)}`)
  lines.push(`判定: ${d.verdict || '(进行中)'}${d.verdictText ? ' - ' + d.verdictText : ''}`)
  lines.push('')
  lines.push('音源尝试顺序:')
  if (!d.attempts.length) {
    lines.push('  (无记录)')
  } else {
    for (const a of d.attempts) {
      const flag = { ok: '成功', cache: '缓存命中', fail: '失败', timeout: '超时', skip: '跳过' }[a.result]
      const limit = a.limit ? `/${a.limit}ms` : ''
      const q = a.quality ? ` [${a.quality}]` : ''
      lines.push(`  ${String(a.seq).padStart(2, '0')}. ${a.source.padEnd(6)} ${flag.padEnd(6)} ${fmt(a.ms).padStart(8)}${limit}${q}${a.message ? '  ' + a.message : ''}`)
    }
  }
  lines.push('')
  lines.push(`平台: ${navigator.platform}  UA: ${navigator.userAgent}`)
  return lines.join('\n')
}
