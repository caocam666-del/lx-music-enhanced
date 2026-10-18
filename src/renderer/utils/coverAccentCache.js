// Luminous Harmonic: 封面取色兜底。
//
// 背景：`coverAccent` / `coverPalette` 原来只在「播放详情页」加载封面时被写入
// （PlayDetail/index.vue 的 @load 回调）。但桌面歌词/灵动岛的取色需要每首歌都有值 ——
// 用户不打开详情页时，它永远是初始默认蓝，导致歌词与进度条颜色与详情页不一致。
//
// 这里做一次解耦的兜底：musicInfo.pic 变化时自己加载封面 → 复用既有的 k-means
// 调色板算法（renderer/utils/coverPalette.js）→ 写入 store。详情页打开时仍走它
// 自己的 <img @load>（同一算法、同一缓存键），结果一致。
//
// 依赖注入（loadImage / extractPalette / apply）让本模块可在 Node 里离线单测。

/** 把 "r, g, b" 三元组解析为数字数组；解析不出返回 null */
export const parseAccentTriple = (value) => {
  const m = String(value ?? '').match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/)
  if (!m) return null
  const out = [Number(m[1]), Number(m[2]), Number(m[3])]
  return out.every(n => n >= 0 && n <= 255) ? out : null
}

/** 把三元组格式化为 store 使用的 "r, g, b" */
export const formatAccentTriple = (rgb) => `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`

/**
 * 计算某个封面 URL 对应的 accent / palette，带按 URL 的记忆化。
 *
 * @param {object} opts
 * @param {string} url 封面地址
 * @param {(url: string) => Promise<any>} opts.loadImage 返回已加载的图片（需有 width/height）
 * @param {(image: any, key: string) => ({accent: string, palette: string[]} | null)} opts.extractPalette
 * @param {Map<string, object>} [opts.cache]
 * @returns {Promise<{accent: string, palette: string[]} | null>}
 */
export const resolveCoverColors = async ({ url, loadImage, extractPalette, cache = new Map() }) => {
  if (!url) return null
  if (cache.has(url)) return cache.get(url)
  let result = null
  try {
    const image = await loadImage(url)
    result = extractPalette(image, url) ?? null
  } catch {
    // 跨域污染 canvas / 图片加载失败 → 交给调用方保留主题色回退
    result = null
  }
  // 失败也缓存（null），避免同一张坏图反复重试
  if (cache.size > 120) cache.clear()
  cache.set(url, result)
  return result
}
