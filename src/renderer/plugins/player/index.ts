interface HTMLAudioElementChrome extends HTMLAudioElement {
  setSinkId: (id: string) => Promise<void>
}
let audio: HTMLAudioElementChrome | null = null
let audioContext: AudioContext
let mediaSource: MediaElementAudioSourceNode
let analyser: AnalyserNode
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext
// https://benzleung.gitbooks.io/web-audio-api-mini-guide/content/chapter5-1.html
export const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
type Freqs = (typeof freqs)[number]
let biquads: Map<`hz${Freqs}`, BiquadFilterNode>
export const freqsPreset = [
  { name: 'pop', hz31: 6, hz62: 5, hz125: -3, hz250: -2, hz500: 5, hz1000: 4, hz2000: -4, hz4000: -3, hz8000: 6, hz16000: 4 },
  { name: 'dance', hz31: 4, hz62: 3, hz125: -4, hz250: -6, hz500: 0, hz1000: 0, hz2000: 3, hz4000: 4, hz8000: 4, hz16000: 5 },
  { name: 'rock', hz31: 7, hz62: 6, hz125: 2, hz250: 1, hz500: -3, hz1000: -4, hz2000: 2, hz4000: 1, hz8000: 4, hz16000: 5 },
  { name: 'classical', hz31: 6, hz62: 7, hz125: 1, hz250: 2, hz500: -1, hz1000: 1, hz2000: -4, hz4000: -6, hz8000: -7, hz16000: -8 },
  { name: 'vocal', hz31: -5, hz62: -6, hz125: -4, hz250: -3, hz500: 3, hz1000: 4, hz2000: 5, hz4000: 4, hz8000: -3, hz16000: -3 },
  { name: 'slow', hz31: 5, hz62: 4, hz125: 2, hz250: 0, hz500: -2, hz1000: 0, hz2000: 3, hz4000: 6, hz8000: 7, hz16000: 8 },
  { name: 'electronic', hz31: 6, hz62: 5, hz125: 0, hz250: -5, hz500: -4, hz1000: 0, hz2000: 6, hz4000: 8, hz8000: 8, hz16000: 7 },
  { name: 'subwoofer', hz31: 8, hz62: 7, hz125: 5, hz250: 4, hz500: 0, hz1000: 0, hz2000: 0, hz4000: 0, hz8000: 0, hz16000: 0 },
  { name: 'soft', hz31: -5, hz62: -5, hz125: -4, hz250: -4, hz500: 3, hz1000: 2, hz2000: 4, hz4000: 4, hz8000: 0, hz16000: 0 },
] as const
export const convolutions = [
  { name: 'telephone', mainGain: 0.0, sendGain: 3.0, source: 'filter-telephone.wav' }, // 电话
  { name: 's2_r4_bd', mainGain: 1.8, sendGain: 0.9, source: 's2_r4_bd.wav' }, // 教堂
  { name: 'bright_hall', mainGain: 0.8, sendGain: 2.4, source: 'bright-hall.wav' },
  { name: 'cinema_diningroom', mainGain: 0.6, sendGain: 2.3, source: 'cinema-diningroom.wav' },
  { name: 'dining_living_true_stereo', mainGain: 0.6, sendGain: 1.8, source: 'dining-living-true-stereo.wav' },
  { name: 'living_bedroom_leveled', mainGain: 0.6, sendGain: 2.1, source: 'living-bedroom-leveled.wav' },
  { name: 'spreader50_65ms', mainGain: 1, sendGain: 2.5, source: 'spreader50-65ms.wav' },
  // { name: 'spreader25_125ms', mainGain: 1, sendGain: 2.5, source: 'spreader25-125ms.wav' },
  // { name: 'backslap', mainGain: 1.8, sendGain: 0.8, source: 'backslap1.wav' },
  { name: 's3_r1_bd', mainGain: 1.8, sendGain: 0.8, source: 's3_r1_bd.wav' },
  { name: 'matrix_1', mainGain: 1.5, sendGain: 0.9, source: 'matrix-reverb1.wav' },
  { name: 'matrix_2', mainGain: 1.3, sendGain: 1, source: 'matrix-reverb2.wav' },
  { name: 'cardiod_35_10_spread', mainGain: 1.8, sendGain: 0.6, source: 'cardiod-35-10-spread.wav' },
  { name: 'tim_omni_35_10_magnetic', mainGain: 1, sendGain: 0.2, source: 'tim-omni-35-10-magnetic.wav' },
  // { name: 'spatialized', mainGain: 1.8, sendGain: 0.8, source: 'spatialized8.wav' },
  // { name: 'zing_long_stereo', mainGain: 0.8, sendGain: 1.8, source: 'zing-long-stereo.wav' },
  { name: 'feedback_spring', mainGain: 1.8, sendGain: 0.8, source: 'feedback-spring.wav' },
  // { name: 'tim_omni_rear_blend', mainGain: 1.8, sendGain: 0.8, source: 'tim-omni-rear-blend.wav' },
] as const
// 半音
// export const semitones = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] as const

let convolver: ConvolverNode
let convolverSourceGainNode: GainNode
let convolverOutputGainNode: GainNode
let convolverDynamicsCompressor: DynamicsCompressorNode
let gainNode: GainNode
let panner: PannerNode
let pitchShifterNode: AudioWorkletNode
let pitchShifterNodePitchFactor: AudioParam
let pitchShifterNodeLoadStatus: 'none' | 'loading' | 'unconnect' | 'connected' = 'none'
let pitchShifterNodeTempValue = 1
let defaultChannelCount = 2
export const soundR = 0.5


// ==================== 音频事件注册表 (切歌过渡: 元素角色交换时监听器可随迁) ====================
type Noop = () => void
const audioEventCallbacks = new Map<string, Set<Noop>>()
const listenAudio = (evt: string, cb: Noop) => {
  let set = audioEventCallbacks.get(evt)
  if (!set) {
    set = new Set()
    audioEventCallbacks.set(evt, set)
  }
  set.add(cb)
  audio?.addEventListener(evt, cb)
  return () => {
    set?.delete(cb)
    audio?.removeEventListener(evt, cb)
  }
}
// 把注册表中的全部监听器从旧元素迁移到新元素 (交叉淡化完成后新旧角色交换)
const swapAudioListeners = (oldEl: HTMLAudioElement, newEl: HTMLAudioElement) => {
  for (const [evt, cbs] of audioEventCallbacks) {
    for (const cb of cbs) {
      oldEl.removeEventListener(evt, cb)
      newEl.addEventListener(evt, cb)
    }
  }
}

export const createAudio = () => {
  if (audio) return
  audio = new window.Audio() as HTMLAudioElementChrome
  audio.controls = false
  audio.autoplay = true
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'

  // https://developer.chrome.com/blog/autoplay
  listenAudio('playing', () => {
    if (audioContext?.state == 'suspended') {
      void audioContext.resume().catch((err) => {
        console.error('Resume audio context failed:', err)
        throw err
      })
    }
  })
  // 切歌过渡 (复刻 pure-music): 注册过渡引擎的播放器事件监听
  initSongTransition()
}

const initAnalyser = () => {
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
}

const initBiquadFilter = () => {
  biquads = new Map()
  let i

  for (const item of freqs) {
    const filter = audioContext.createBiquadFilter()
    biquads.set(`hz${item}`, filter)
    filter.type = 'peaking'
    filter.frequency.value = item
    filter.Q.value = 1.4
    filter.gain.value = 0
  }

  for (i = 1; i < freqs.length; i++) {
    (biquads.get(`hz${freqs[i - 1]}`)!).connect(biquads.get(`hz${freqs[i]}`)!)
  }
}

const initConvolver = () => {
  convolverSourceGainNode = audioContext.createGain()
  convolverOutputGainNode = audioContext.createGain()
  convolverDynamicsCompressor = audioContext.createDynamicsCompressor()
  convolver = audioContext.createConvolver()
  convolver.connect(convolverOutputGainNode)
  convolverSourceGainNode.connect(convolverDynamicsCompressor)
  convolverOutputGainNode.connect(convolverDynamicsCompressor)
}

const initPanner = () => {
  panner = audioContext.createPanner()
}

const initGain = () => {
  gainNode = audioContext.createGain()
}

const initAdvancedAudioFeatures = () => {
  if (audioContext) return
  if (!audio) throw new Error('audio not defined')
  audioContext = new window.AudioContext({ latencyHint: 'playback' })
  defaultChannelCount = audioContext.destination.channelCount

  initAnalyser()
  initBiquadFilter()
  initConvolver()
  initPanner()
  initGain()
  // source -> analyser -> biquadFilter -> pitchShifter -> [(convolver & convolverSource)->convolverDynamicsCompressor] -> panner -> gain
  mediaSource = audioContext.createMediaElementSource(audio)
  mediaSource.connect(analyser)
  analyser.connect(biquads.get(`hz${freqs[0]}`)!)
  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.connect(convolverSourceGainNode)
  lastBiquadFilter.connect(convolver)
  convolverDynamicsCompressor.connect(panner)
  panner.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // 音频输出设备改变时刷新 audio node 连接
  window.app_event.on('playerDeviceChanged', handleMediaListChange)

  // audio.addEventListener('playing', connectAudioNode)
  // audio.addEventListener('pause', disconnectAudioNode)
  // audio.addEventListener('waiting', disconnectAudioNode)
  // audio.addEventListener('emptied', disconnectAudioNode)
  // if (!audio.paused) connectAudioNode()
}

const handleMediaListChange = () => {
  mediaSource.disconnect()
  mediaSource.connect(analyser)
}

// let isConnected = true
// const connectAudioNode = () => {
//   if (isConnected) return
//   console.log('connect Node')
//   mediaSource.connect(analyser)
//   isConnected = true
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

// const disconnectAudioNode = () => {
//   if (!isConnected) return
//   console.log('disconnect Node')
//   mediaSource.disconnect()
//   isConnected = false
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

export const getAudioContext = () => {
  initAdvancedAudioFeatures()
  return audioContext
}

let unsubMediaListChangeEvent: (() => void) | null = null
export const setMaxOutputChannelCount = (enable: boolean) => {
  if (enable) {
    initAdvancedAudioFeatures()
    audioContext.destination.channelCountMode = 'max'
    audioContext.destination.channelCount = audioContext.destination.maxChannelCount
    // navigator.mediaDevices.addEventListener('devicechange', handleMediaListChange)
    if (!unsubMediaListChangeEvent) {
      let handleMediaListChange = () => {
        setMaxOutputChannelCount(true)
      }
      window.app_event.on('playerDeviceChanged', handleMediaListChange)
      unsubMediaListChangeEvent = () => {
        window.app_event.off('playerDeviceChanged', handleMediaListChange)
        unsubMediaListChangeEvent = null
      }
    }
  } else {
    unsubMediaListChangeEvent?.()
    if (audioContext && audioContext.destination.channelCountMode != 'explicit') {
      audioContext.destination.channelCount = defaultChannelCount
      // audioContext.destination.channelInterpretation
      audioContext.destination.channelCountMode = 'explicit'
    }
  }
}

export const getAnalyser = (): AnalyserNode | null => {
  initAdvancedAudioFeatures()
  return analyser
}

export const getBiquadFilter = () => {
  initAdvancedAudioFeatures()
  return biquads
}

// let isConvolverConnected = false
export const setConvolver = (buffer: AudioBuffer | null, mainGain: number, sendGain: number) => {
  initAdvancedAudioFeatures()
  convolver.buffer = buffer
  // console.log(mainGain, sendGain)
  if (buffer) {
    convolverSourceGainNode.gain.value = mainGain
    convolverOutputGainNode.gain.value = sendGain
  } else {
    convolverSourceGainNode.gain.value = 1
    convolverOutputGainNode.gain.value = 0
  }
}

export const setConvolverMainGain = (gain: number) => {
  if (convolverSourceGainNode.gain.value == gain) return
  // console.log(gain)
  convolverSourceGainNode.gain.value = gain
}

export const setConvolverSendGain = (gain: number) => {
  if (convolverOutputGainNode.gain.value == gain) return
  // console.log(gain)
  convolverOutputGainNode.gain.value = gain
}

let pannerInfo = {
  x: 0,
  y: 0,
  z: 0,
  soundR: 0.5,
  rad: 0,
  speed: 1,
  intv: null as NodeJS.Timeout | null,
}
const setPannerXYZ = (nx: number, ny: number, nz: number) => {
  pannerInfo.x = nx
  pannerInfo.y = ny
  pannerInfo.z = nz
  // console.log(pannerInfo)
  panner.positionX.value = nx * pannerInfo.soundR
  panner.positionY.value = ny * pannerInfo.soundR
  panner.positionZ.value = nz * pannerInfo.soundR
}
export const setPannerSoundR = (r: number) => {
  pannerInfo.soundR = r
}

export const setPannerSpeed = (speed: number) => {
  pannerInfo.speed = speed
  if (pannerInfo.intv) startPanner()
}
export const stopPanner = () => {
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  panner.positionX.value = 0
  panner.positionY.value = 0
  panner.positionZ.value = 0
}

export const startPanner = () => {
  initAdvancedAudioFeatures()
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  pannerInfo.intv = setInterval(() => {
    pannerInfo.rad += 1
    if (pannerInfo.rad > 360) pannerInfo.rad -= 360
    setPannerXYZ(Math.sin(pannerInfo.rad * Math.PI / 180), Math.cos(pannerInfo.rad * Math.PI / 180), Math.cos(pannerInfo.rad * Math.PI / 180))
  }, pannerInfo.speed * 10)
}

let isConnected = true
const connectNode = () => {
  if (isConnected) return
  console.log('connect Node')
  analyser?.connect(biquads.get(`hz${freqs[0]}`)!)
  isConnected = true
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const disconnectNode = () => {
  if (!isConnected) return
  console.log('disconnect Node')
  analyser?.disconnect()
  isConnected = false
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const connectPitchShifterNode = () => {
  console.log('connect Pitch Shifter Node')
  audio!.addEventListener('playing', connectNode)
  audio!.addEventListener('pause', disconnectNode)
  audio!.addEventListener('waiting', disconnectNode)
  audio!.addEventListener('emptied', disconnectNode)
  if (audio!.paused) disconnectNode()

  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(pitchShifterNode)

  pitchShifterNode.connect(convolver)
  pitchShifterNode.connect(convolverSourceGainNode)
  // convolverDynamicsCompressor.disconnect(panner)
  // convolverDynamicsCompressor.connect(pitchShifterNode)
  // pitchShifterNode.connect(panner)
  pitchShifterNodeLoadStatus = 'connected'
  pitchShifterNodePitchFactor.value = pitchShifterNodeTempValue
}
const disconnectPitchShifterNode = () => {
  console.log('disconnect Pitch Shifter Node')
  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(convolver)
  lastBiquadFilter.connect(convolverSourceGainNode)
  pitchShifterNodeLoadStatus = 'unconnect'

  audio!.removeEventListener('playing', connectNode)
  audio!.removeEventListener('pause', disconnectNode)
  audio!.removeEventListener('waiting', disconnectNode)
  audio!.removeEventListener('emptied', disconnectNode)
  connectNode()
}
const loadPitchShifterNode = () => {
  pitchShifterNodeLoadStatus = 'loading'
  initAdvancedAudioFeatures()
  // source -> analyser -> biquadFilter -> audioWorklet(pitch shifter) -> [(convolver & convolverSource)->convolverDynamicsCompressor] -> panner -> gain
  void audioContext.audioWorklet.addModule(new URL(
    /* webpackChunkName: 'pitch_shifter.audioWorklet' */
    './pitch-shifter/phase-vocoder.js',
    import.meta.url,
  )).then(() => {
    console.log('pitch shifter audio worklet loaded')
    // https://github.com/olvb/phaze/issues/26#issuecomment-1574629971
    pitchShifterNode = new AudioWorkletNode(audioContext, 'phase-vocoder-processor', { outputChannelCount: [2] })
    let pitchFactorParam = pitchShifterNode.parameters.get('pitchFactor')
    if (!pitchFactorParam) return
    pitchShifterNodePitchFactor = pitchFactorParam
    pitchShifterNodeLoadStatus = 'unconnect'
    if (pitchShifterNodeTempValue == 1) return

    connectPitchShifterNode()
  })
}

export const setPitchShifter = (val: number) => {
  // console.log('setPitchShifter', val)
  pitchShifterNodeTempValue = val
  switch (pitchShifterNodeLoadStatus) {
    case 'loading':
      break
    case 'none':
      loadPitchShifterNode()
      break
    case 'connected':
      // a: 1 = 半音
      // value = 2 ** (a / 12)
      pitchShifterNodePitchFactor.value = val
      break
    case 'unconnect':
      connectPitchShifterNode()
      break
  }
}

export const hasInitedAdvancedAudioFeatures = (): boolean => audioContext != null

// ==================== 切歌过渡 (复刻 pure-music) ====================
// 对齐 pure-music (BASS mixer) 的行为与参数:
// none      无缝衔接: 曲尾提前预载下一首, 播完零间隙切换 (对应 gapless 队列)
// fade      淡入淡出: 旧歌淡出结束后新歌再淡入 (顺序; pure-music fade 分支)
// crossfade 交叉淡化: 剩余 CF_S 秒时新歌提前接入, 等功率曲线交叠混音 (pure-music 默认 4500ms)
// smart     智能衔接: pure-music planner 的可流式化近似 —
//           ① 尾部持续静音 → 提前切歌 (SILENCE_TRIM 思路, 跳过尾奏静音)
//           ② 新歌开头静音 → 自动前跳 (entrance cue 思路)
//           ③ 结尾能量自然衰减 → fade; 高能收尾 → energy_crossfade (4.5s 等功率)
type SongTransitionMode = 'none' | 'fade' | 'crossfade' | 'smart'
const PRELOAD_S = 15 // 提前解析并预载下一首的时机 (秒, 全部模式生效)
const CF_S = 4.5 // 交叉淡化重叠窗口 (秒)
const FADE_OUT_S = 3 // 淡出时长 (秒)
const FADE_IN_S = 1.5 // 淡入时长 (秒)
const EARLY_SWITCH_MIN_S = 6 // 提前切歌要求的最小剩余时长 (秒)
const LEAD_SKIP_MAX_S = 6 // 新歌开头静音最多前跳 (秒)
const SILENCE_FLOOR = 0.008 // 静音判定阈值 (RMS, ≈ -42dBFS)
const SILENCE_HOLD_MS = 2500 // 尾部持续静音判定窗口 (毫秒)

type CrossfadeRequestHandler = () => Promise<string | null>
let crossfadeRequestHandler: CrossfadeRequestHandler | null = null
// core/player/action 注入: 解析下一首并预取播放 URL (返回 null 表示无法预载)
export const setCrossfadeRequestHandler = (handler: CrossfadeRequestHandler | null) => {
  crossfadeRequestHandler = handler
}

const transitionState = {
  mode: 'none' as SongTransitionMode,
  active: false, // 交叉淡化/提前切歌进行中
  preloadTried: false, // 本首歌是否已触发下一首预载
  waitingCrossfade: false, // 预载完成且处于交叉窗口, 等待/正在开始交叠
  shadow: null as HTMLAudioElementChrome | null,
  pendingUrl: '', // 已预载的下一首 URL
  fadeInNext: false, // 上首歌淡出自然结束后, 新歌需要淡入
  fadeOutStarted: false,
  earlySwitched: false, // 智能衔接: 已因尾部静音提前切歌
  silenceSince: null as number | null,
  smartSamples: [] as Array<{ t: number, rms: number }>,
  smartDecided: null as null | 'fade' | 'crossfade',
  rampTokens: new WeakMap<HTMLAudioElement, number>(),
  baseVolume: 1,
  promotedViaTransition: false, // 交叉淡化已在 ended 时完成接管, action 层的 setStop/setResource 需让行
}

const shadowSourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

export const setSongTransition = (mode: SongTransitionMode) => {
  transitionState.mode = mode
  cancelTransition(false)
}

const cancelRamp = (el: HTMLAudioElement) => {
  transitionState.rampTokens.set(el, (transitionState.rampTokens.get(el) ?? 0) + 1)
}

// 曲线: 'out' 等功率淡出 (慢起快收) / 'in' 等功率淡入 (快起慢收) / 'lin' 线性
const rampVolume = (el: HTMLAudioElement, to: number, durSec: number, curve: 'out' | 'in' | 'lin' = 'lin', onDone?: () => void) => {
  const token = (transitionState.rampTokens.get(el) ?? 0) + 1
  transitionState.rampTokens.set(el, token)
  const from = el.volume
  const start = performance.now()
  const durMs = Math.max(50, durSec * 1000)
  const shaped = (progress: number) => {
    switch (curve) {
      case 'out': return to + (from - to) * Math.cos(progress * Math.PI / 2)
      case 'in': return from + (to - from) * Math.sin(progress * Math.PI / 2)
      default: return from + (to - from) * progress
    }
  }
  // 注意: 必须用 setInterval 而非 requestAnimationFrame —
  // 窗口在后台时 rAF 完全暂停, 渐变会冻在半路 (音量卡在极小值直到用户拖动进度条)
  const timer = window.setInterval(() => {
    if (transitionState.rampTokens.get(el) !== token) {
      window.clearInterval(timer)
      return
    }
    const progress = Math.min(1, (performance.now() - start) / durMs)
    el.volume = Math.max(0, Math.min(1, shaped(progress)))
    if (progress >= 1) {
      window.clearInterval(timer)
      onDone?.()
    }
  }, 40)
}

// 本首歌的过渡状态复位 (切到新歌/剩余时间回到窗口外时)
const resetTrackTransitionState = () => {
  transitionState.preloadTried = false
  transitionState.waitingCrossfade = false
  transitionState.pendingUrl = ''
  transitionState.fadeOutStarted = false
  transitionState.fadeInNext = false
  transitionState.earlySwitched = false
  transitionState.silenceSince = null
  transitionState.smartSamples = []
  transitionState.smartDecided = null
}

const getShadowElement = () => {
  if (!transitionState.shadow) {
    transitionState.shadow = new window.Audio() as HTMLAudioElementChrome
    transitionState.shadow.preload = 'auto'
  }
  // 已初始化音效链时, 影子元素接入同一链路 (共享均衡器/混响等); 未初始化则直接输出
  if (audioContext && !shadowSourceMap.has(transitionState.shadow)) {
    try {
      const source = audioContext.createMediaElementSource(transitionState.shadow)
      source.connect(analyser)
      shadowSourceMap.set(transitionState.shadow, source)
    } catch { /* 接入失败则直连输出 */ }
  }
  return transitionState.shadow
}

const cancelTransition = (restoreVolume = true) => {
  transitionState.active = false
  transitionState.promotedViaTransition = false
  transitionState.waitingCrossfade = false
  transitionState.pendingUrl = ''
  transitionState.fadeInNext = false
  transitionState.fadeOutStarted = false
  transitionState.earlySwitched = false
  transitionState.silenceSince = null
  transitionState.smartDecided = null
  transitionState.smartSamples = []
  transitionState.preloadTried = false
  const shadow = transitionState.shadow
  if (shadow) {
    cancelRamp(shadow)
    try { shadow.pause(); shadow.removeAttribute('src') } catch { /* ignore */ }
  }
  if (restoreVolume && audio) {
    cancelRamp(audio)
    audio.volume = transitionState.baseVolume
  }
}

const promoteShadow = () => {
  const newAudio = transitionState.shadow
  const oldAudio = audio
  if (!newAudio || !oldAudio) return
  if (pitchShifterNodeLoadStatus == 'connected') disconnectPitchShifterNode()
  cancelRamp(newAudio)
  newAudio.volume = transitionState.baseVolume
  // 先迁移监听器再清理旧元素, 避免 old 清 src 触发 emptied 事件
  console.log('[transition] promote shadow -> primary')
  swapAudioListeners(oldAudio, newAudio)
  audio = newAudio
  transitionState.shadow = oldAudio
  transitionState.active = false
  transitionState.fadeInNext = false
  resetTrackTransitionState()
  // 注意: 必须在 resetTrackTransitionState 之后置位 — 该函数会重置本首歌的过渡状态,
  // 而此标志是给随后的 action 层交接 (setStop/setResource 让行) 用的
  transitionState.promotedViaTransition = true
  try { oldAudio.pause(); oldAudio.removeAttribute('src') } catch { /* ignore */ }
  if (pitchShifterNodeLoadStatus == 'connected') connectPitchShifterNode()
}

// 智能衔接: 采样结尾能量, 自然衰减→fade, 高能收尾→crossfade
const sampleSmart = (remaining: number) => {
  if (!analyser) return
  try {
    const buf = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    transitionState.smartSamples.push({ t: remaining, rms: Math.sqrt(sum / buf.length) })
  } catch { /* ignore */ }
}

const decideSmart = (): 'fade' | 'crossfade' => {
  if (transitionState.smartDecided) return transitionState.smartDecided
  const windowAvg = (lo: number, hi: number) => {
    const arr = transitionState.smartSamples.filter(s => s.t <= lo && s.t >= hi)
    if (!arr.length) return 0
    return arr.reduce((sum, s) => sum + s.rms, 0) / arr.length
  }
  const early = windowAvg(PRELOAD_S, PRELOAD_S - 3)
  const late = windowAvg(7, 5)
  // 无参考数据 (音效链未初始化等) 或能量未明显衰减 → 交叉淡化; 能量明显衰减 → 淡入淡出
  const decided = (early > 0 && late / early < 0.5) ? 'fade' : 'crossfade'
  transitionState.smartDecided = decided
  return decided
}

const effectiveMode = (): 'none' | 'fade' | 'crossfade' => {
  switch (transitionState.mode) {
    case 'fade': return 'fade'
    case 'crossfade': return 'crossfade'
    case 'smart': return decideSmart()
    default: return 'none'
  }
}

// 智能衔接: 新歌开头静音自动前跳 (entrance cue), 最多 LEAD_SKIP_MAX_S 秒
const startLeadSilenceSkip = (shadow: HTMLAudioElementChrome) => {
  const source = shadowSourceMap.get(shadow)
  if (!source || !audioContext) return
  let analyserNode: AnalyserNode
  try {
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 256
    source.connect(analyserNode)
  } catch { return }
  const buf = new Uint8Array(analyserNode.fftSize)
  let skipped = 0
  const cleanup = () => {
    window.clearInterval(timer)
    try { source.disconnect(analyserNode) } catch { /* ignore */ }
  }
  const timer = window.setInterval(() => {
    if (transitionState.shadow !== shadow || !transitionState.active) {
      cleanup()
      return
    }
    try { analyserNode.getByteTimeDomainData(buf) } catch { cleanup(); return }
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / buf.length)
    if (rms < SILENCE_FLOOR && skipped < LEAD_SKIP_MAX_S) {
      skipped += 0.6
      try { shadow.currentTime += 0.6 } catch { cleanup() }
    } else {
      cleanup()
    }
  }, 300)
}

const startOverlap = (fadeSec: number) => {
  const el = audio
  if (!el || !transitionState.pendingUrl) return
  const url = transitionState.pendingUrl
  transitionState.pendingUrl = ''
  console.log('[transition] overlap start, fadeSec=' + fadeSec.toFixed(1))
  transitionState.active = true
  transitionState.waitingCrossfade = false
  const shadow = getShadowElement()
  shadow.volume = 0
  shadow.src = url
  void shadow.play().catch(() => {
    cancelTransition(true)
  })
  rampVolume(shadow, transitionState.baseVolume, Math.max(1, fadeSec), 'in')
  rampVolume(el, 0, fadeSec, 'out')
  if (transitionState.mode == 'smart') startLeadSilenceSkip(shadow)
}

const tryStartCrossfade = () => {
  if (!audio || transitionState.active || !transitionState.pendingUrl) return
  if (effectiveMode() != 'crossfade') return // 只有交叉淡化才交叠; 其他模式预载仅用于零间隙切换
  const duration = audio.duration
  if (!isFinite(duration) || duration <= 0) return
  const remaining = duration - audio.currentTime
  if (remaining > CF_S) {
    transitionState.waitingCrossfade = true
    return
  }
  if (remaining <= 2) { // 剩余太短, 交叠听感差 → 放弃, 走自然切换 (已有预载, 间隙≈0)
    transitionState.pendingUrl = ''
    return
  }
  startOverlap(remaining)
}

// 智能衔接: 尾部持续静音 → 提前交叠切歌, 跳过尾奏静音
const startEarlySwitch = () => {
  const el = audio
  if (!el || !transitionState.pendingUrl) return
  console.log('[transition] smart: trailing silence, early switch')
  transitionState.earlySwitched = true
  startOverlap(1.5)
  // 淡出完成后合成 ended 事件, 走正常切歌链 (playNext → 预载 URL → 影子元素无缝接管)
  rampVolume(el, 0, 1.5, 'out', () => {
    try { el.dispatchEvent(new Event('ended')) } catch { /* ignore */ }
  })
}

const handleTimeUpdateForTransition = () => {
  if (!audio || transitionState.active || transitionState.earlySwitched) return
  const duration = audio.duration
  if (!isFinite(duration) || duration <= 0) {
    // 直播流/无时长: 复位窗口外状态
    if (transitionState.preloadTried) resetTrackTransitionState()
    return
  }
  const remaining = duration - audio.currentTime
  if (remaining > PRELOAD_S) {
    if (transitionState.preloadTried) resetTrackTransitionState()
    return
  }
  if (transitionState.mode == 'smart') sampleSmart(remaining)

  // 所有模式都提前预载下一首 URL — 消除切歌时的网络解析间隙 (pure-music 的"入队")
  if (!transitionState.preloadTried) {
    transitionState.preloadTried = true
    void Promise.resolve(crossfadeRequestHandler?.() ?? null).then(url => {
      console.log('[transition] preload:', url ? 'ok' : 'unavailable')
      transitionState.pendingUrl = url ?? ''
      tryStartCrossfade()
    }).catch(err => {
      console.log('[transition] preload failed:', err?.message ?? err)
      transitionState.pendingUrl = ''
    })
  }

  // 智能衔接: 尾部持续静音 → 提前切歌 (跳过尾奏静音)
  if (transitionState.mode == 'smart' && remaining > EARLY_SWITCH_MIN_S) {
    const last = transitionState.smartSamples.at(-1)
    if (last && last.rms < SILENCE_FLOOR) {
      if (transitionState.silenceSince == null) transitionState.silenceSince = performance.now()
      else if (performance.now() - transitionState.silenceSince >= SILENCE_HOLD_MS && transitionState.pendingUrl) {
        startEarlySwitch()
        return
      }
    } else {
      transitionState.silenceSince = null
    }
  }

  const mode = effectiveMode()
  if (mode == 'crossfade') {
    tryStartCrossfade()
    return // 交叠包络接管音量, 不再叠加淡出
  }
  if (mode == 'fade' && remaining <= FADE_OUT_S && !transitionState.fadeOutStarted && remaining > 0.15) {
    transitionState.fadeOutStarted = true
    rampVolume(audio, 0, remaining, 'out', () => {
      transitionState.fadeInNext = true
    })
  }
}

const handlePlayingForTransition = () => {
  if (transitionState.active) return
  if (transitionState.fadeInNext && audio) {
    transitionState.fadeInNext = false
    audio.volume = 0
    rampVolume(audio, transitionState.baseVolume, FADE_IN_S, 'in')
  }
}

const initSongTransition = () => {
  listenAudio('timeupdate', handleTimeUpdateForTransition)
  listenAudio('playing', handlePlayingForTransition)
  listenAudio('pause', () => {
    // 暂停时终止交叠, 恢复主元素音量
    if (transitionState.active) cancelTransition(true)
  })
  listenAudio('seeking', () => {
    cancelTransition(false)
    if (audio) audio.volume = transitionState.baseVolume
  })
  listenAudio('ended', () => {
    if (!audio) return
    // 交叉淡化交叠中旧歌自然播完 → 延迟一拍把影子元素转正, 新歌从已播位置继续 (不重新加载)。
    // 必须异步: 同步转正会把注册表监听器从正在派发 ended 的旧元素上移走,
    // 导致同一轮派发中尚未执行的 usePlayerEvent.onEnded (推进切歌链) 被丢弃
    if (transitionState.active && transitionState.shadow) {
      window.setTimeout(() => {
        if (transitionState.active && transitionState.shadow) promoteShadow()
      }, 0)
      return
    }
    if (audio.volume < 0.05 && transitionState.mode == 'fade') transitionState.fadeInNext = true
  })
}

export const getSongTransitionMode = (): SongTransitionMode => transitionState.mode

export const setResource = (src: string) => {
  if (!audio) return
  // 交叉淡化进行中且换入的正是影子元素已在播的流 → 直接交换角色 (无缝接管, 不重新加载)
  if (transitionState.active && transitionState.shadow && transitionState.shadow.src === src) {
    promoteShadow()
    return
  }
  const wasPromoted = transitionState.promotedViaTransition
  // 淡入淡出: 淡出结束时置的"下一首淡入"标志必须跨过 cancelTransition 保留,
  // 否则新歌会以淡出残留的近零音量开播且无人拉起 (直到用户拖动进度条)
  const keepFadeIn = transitionState.fadeInNext
  transitionState.promotedViaTransition = false
  // 接管完成后 action 层送来同一首歌的 URL → 元素已在播该流, 忽略 (重新赋值会从头播放)
  if (wasPromoted && (audio.src === src || audio.getAttribute('src') === src)) {
    // 元素持续在播不会再触发 playing 事件, 手动补发以同步播放状态 (isPlay/进度)
    audio.dispatchEvent(new Event('playing'))
    return
  }
  cancelTransition(true)
  transitionState.fadeInNext = keepFadeIn
  audio.src = src
}

export const setPlay = () => {
  void audio?.play()
}

export const setPause = () => {
  audio?.pause()
}

export const setStop = () => {
  // 交叉淡化接管后 audio 已是正在播的新歌, 此时 action 层的 handlePlay 会先调 setStop 清空 src —
  // 不让行会把新歌杀掉 (随后 setResource 重新加载 → 新歌从头播放)
  if (transitionState.promotedViaTransition) return
  if (audio) {
    audio.src = ''
    audio.removeAttribute('src')
  }
}

export const isEmpty = (): boolean => !audio?.src

export const setLoopPlay = (isLoop: boolean) => {
  if (audio) audio.loop = isLoop
}

export const getPlaybackRate = (): number => {
  return audio?.defaultPlaybackRate ?? 1
}

export const setPlaybackRate = (rate: number) => {
  if (!audio) return
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
}

export const setPreservesPitch = (preservesPitch: boolean) => {
  if (!audio) return
  audio.preservesPitch = preservesPitch
}

export const getMute = (): boolean => {
  return audio?.muted ?? false
}

export const setMute = (isMute: boolean) => {
  if (audio) audio.muted = isMute
}

// Luminous Harmonic: 音频元素是否正在实际播放 (未暂停/未结束) —
// 换曲加载窗口内 currentTime 是旧音源的残留值, 歌词同步需要区分这种情况
export const isAudioActivelyPlaying = () => {
  return !!audio && !audio.paused && !audio.ended
}

export const getCurrentTime = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return audio?.currentTime || 0
}

export const setCurrentTime = (time: number) => {
  if (audio) audio.currentTime = time
}

export const setMediaDeviceId = async(mediaDeviceId: string): Promise<void> => {
  if (!audio) return
  return audio.setSinkId(mediaDeviceId)
}

export const setVolume = (volume: number) => {
  transitionState.baseVolume = Math.max(0, Math.min(1, volume))
  // 用户手动调整音量时立即接管, 打断过渡淡入淡出
  if (audio && transitionState.active) cancelTransition(false)
  if (audio) {
    cancelRamp(audio)
    audio.volume = transitionState.baseVolume
  }
}

export const getDuration = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return audio?.duration || 0
}

// export const getPlaybackRate = () => {
//   return audio?.playbackRate ?? 1
// }

export const onPlaying = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('playing', callback)
}

export const onPause = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('pause', callback)
}

export const onEnded = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('ended', callback)
}

export const onError = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('error', callback)
}

export const onLoadeddata = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('loadeddata', callback)
}

export const onLoadstart = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('loadstart', callback)
}

export const onCanplay = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('canplay', callback)
}

export const onEmptied = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('emptied', callback)
}

export const onTimeupdate = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('timeupdate', callback)
}

// 缓冲中
export const onWaiting = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')
  return listenAudio('waiting', callback)
}

// 可见性改变
export const onVisibilityChange = (callback: Noop) => {
  document.addEventListener('visibilitychange', callback)
  return () => {
    document.removeEventListener('visibilitychange', callback)
  }
}


export const getErrorCode = () => {
  return audio?.error?.code
}
