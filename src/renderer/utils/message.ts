export const requestMsg = {
  fail: '请求异常😮，可以多试几次，若还是不行就换一首吧。。。',
  unachievable: '哦No😱...接口无法访问了！',
  timeout: '请求超时',
  // unachievable: '哦No😱...接口无法访问了！已帮你切换到临时接口，重试下看能不能播放吧~',
  notConnectNetwork: '无法连接到服务器',
  cancelRequest: '取消http请求',
  tooManyRequests: '服务器繁忙',
  /** Luminous Harmonic: 所有音源都已尝试/换源预算耗尽 —— 本首歌确实放不了, 应计入连续失败 */
  sourceExhausted: '所有音源均无法播放',
  /** Luminous Harmonic: 单个音源在时限内没能拿到链接（超时或接口报错） */
  sourceTimeout: '接口请求失败, 正在尝试其他音源',
  /** Luminous Harmonic: 音频元素加载/解码失败且刷新 URL 已用尽 */
  audioLoadFailed: '音频加载失败, 即将切换下一首',
} as const

/**
 * Luminous Harmonic: 播放失败的错误分级 —— 决定「是否计入连续失败 / 是否自动切歌」
 *   fatalUrl    取不到任何可用 URL（换源预算耗尽或全部音源失败）→ 本首歌放不了, 计入并跳过
 *   fatalAudio  音频元素解码/加载失败且已重试完 → 计入并跳过
 *   transient   服务器繁忙 / 断网 / 单源超时 → 只提示, 不计入连续失败
 *   none        用户主动中断等 → 完全忽略
 */
export const PLAY_ERROR = {
  fatalUrl: 'fatalUrl',
  fatalAudio: 'fatalAudio',
  transient: 'transient',
  none: 'none',
} as const

export type PlayErrorKind = typeof PLAY_ERROR[keyof typeof PLAY_ERROR]
