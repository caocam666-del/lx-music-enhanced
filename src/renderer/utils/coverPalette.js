// Luminous Harmonic: Pure-music 式封面取色 — CIE-Lab 空间 k-means 调色板
// 手法对标 _pure_music_src/rust/src/api/color_extraction.rs：
//   缩样(64px) → 剔除透明/边缘像素(视觉中心加权 0.6~1.4) → Lab k-means 聚类
//   → 主色家族槽位分配(防纯色封面被拆成近似色) → Lab 距离分散选色 → 背景色柔化
// 3k 像素 × k=5 × 8 次迭代，同步执行 <10ms，无需 Worker。

const SAMPLE_SIZE = 64
const K = 5
const ITERATIONS = 8
const PALETTE_SIZE = 4
const CACHE_MAX = 200
const FAMILY_DIST = 25 // Lab 距离小于该值视为"主色家族"

const cache = new Map()

const srgbToLinear = c => {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

const rgbToLab = (r, g, b, out, i) => {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)
  // sRGB → XYZ (D65) → Lab
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116
  out[i] = 116 * fy - 16
  out[i + 1] = 500 * (fx - fy)
  out[i + 2] = 200 * (fy - fz)
}

const labDist2 = (labs, i, j) => {
  const dl = labs[i] - labs[j]
  const da = labs[i + 1] - labs[j + 1]
  const db = labs[i + 2] - labs[j + 2]
  return dl * dl + da * da + db * db
}

// 加权 k-means。返回按权重降序的簇 [{lab, rgb, weight}]
const runKmeans = (labs, rgbs, weights, n) => {
  const centers = new Float32Array(K * 3)
  // 初始中心：按亮度排序后等距取样，确定性且覆盖明暗范围
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => labs[a * 3] - labs[b * 3])
  for (let k = 0; k < K; k++) {
    const idx = order[Math.min(n - 1, Math.floor((k + 0.5) / K * n))]
    centers[k * 3] = labs[idx * 3]
    centers[k * 3 + 1] = labs[idx * 3 + 1]
    centers[k * 3 + 2] = labs[idx * 3 + 2]
  }

  const assign = new Uint8Array(n)
  for (let iter = 0; iter <= ITERATIONS; iter++) {
    const isLast = iter == ITERATIONS
    if (!isLast) {
      for (let i = 0; i < n; i++) {
        let best = 0
        let bestD = Infinity
        for (let k = 0; k < K; k++) {
          const dl = labs[i * 3] - centers[k * 3]
          const da = labs[i * 3 + 1] - centers[k * 3 + 1]
          const db = labs[i * 3 + 2] - centers[k * 3 + 2]
          const d = dl * dl + da * da + db * db
          if (d < bestD) {
            bestD = d
            best = k
          }
        }
        assign[i] = best
      }
      // 加权更新中心
      const sums = new Float64Array(K * 4) // L,A,B,weight
      for (let i = 0; i < n; i++) {
        const k = assign[i] * 4
        const w = weights[i]
        sums[k] += labs[i * 3] * w
        sums[k + 1] += labs[i * 3 + 1] * w
        sums[k + 2] += labs[i * 3 + 2] * w
        sums[k + 3] += w
      }
      for (let k = 0; k < K; k++) {
        if (sums[k * 4 + 3] > 0) {
          centers[k * 3] = sums[k * 4] / sums[k * 4 + 3]
          centers[k * 3 + 1] = sums[k * 4 + 1] / sums[k * 4 + 3]
          centers[k * 3 + 2] = sums[k * 4 + 2] / sums[k * 4 + 3]
        }
      }
    } else {
      // 最后一轮：输出簇统计（含 RGB 均值）
      const clusters = []
      for (let k = 0; k < K; k++) clusters.push(null)
      const acc = new Float64Array(K * 7) // L,A,B,R,G,B,weight
      for (let i = 0; i < n; i++) {
        let best = 0
        let bestD = Infinity
        for (let k = 0; k < K; k++) {
          const d = labDist2(labs, i * 3, k * 3)
          if (d < bestD) {
            bestD = d
            best = k
          }
        }
        const a = best * 7
        const w = weights[i]
        acc[a] += labs[i * 3] * w
        acc[a + 1] += labs[i * 3 + 1] * w
        acc[a + 2] += labs[i * 3 + 2] * w
        acc[a + 3] += rgbs[i * 3] * w
        acc[a + 4] += rgbs[i * 3 + 1] * w
        acc[a + 5] += rgbs[i * 3 + 2] * w
        acc[a + 6] += w
      }
      let total = 0
      for (let k = 0; k < K; k++) {
        const w = acc[k * 7 + 6]
        if (w <= 0) continue
        total += w
        clusters[k] = {
          lab: [acc[k * 7] / w, acc[k * 7 + 1] / w, acc[k * 7 + 2] / w],
          rgb: [acc[k * 7 + 3] / w, acc[k * 7 + 4] / w, acc[k * 7 + 5] / w].map(v => Math.round(v)),
          weight: w,
        }
      }
      if (!total) return []
      for (const c of clusters) if (c) c.weight /= total
      return clusters.filter(Boolean).sort((a, b) => b.weight - a.weight)
    }
  }
  return []
}

const distLab = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

// 背景色亮度治理（对齐 Pure-music soften_color_for_background + _adjustMeshColors 思路）：
// HSL 饱和度上限 0.78；亮度钳制 0.10~0.45 — 背景专用色必须落在暗区,
// 否则亮调色板色会在流光层形成刺眼亮斑、压过前景文字 (accent 强调色不走此函数, 保持鲜亮)
const soften = ([r, g, b]) => {
  let [h, s, l] = rgbToHsl(r, g, b)
  s = Math.min(s, 0.78)
  l = Math.min(Math.max(l, 0.1), 0.45)
  return hslToRgb(h, s, l)
}

const rgbToHsl = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max == min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max == r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max == g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

const hslToRgb = (h, s, l) => {
  if (s == 0) return [l, l, l].map(v => Math.round(v * 255))
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = t => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(v => Math.round(v * 255))
}

const toCss = ([r, g, b]) => `${r}, ${g}, ${b}`

const luminanceOf = ([r, g, b]) => (r * 299 + g * 587 + b * 114) / 1000

// 从簇列表产出 {accent, palette}
const buildPalette = clusters => {
  const primary = clusters[0]
  // 主色家族占比（与主色 Lab 距离近的簇权重之和）
  let familyWeight = 0
  for (const c of clusters) if (distLab(c.lab, primary.lab) < FAMILY_DIST) familyWeight += c.weight
  const familyShare = familyWeight // clusters 权重已归一化

  // Pure-music 槽位：家族占比 ≥78% 占 3 槽，≥55% 占 2 槽，其余给点缀色
  const primarySlots = familyShare >= 0.78 ? 3 : familyShare >= 0.55 ? 2 : 1

  // 点缀色：贪心"最远点 + 彩度加成"选取，保证调色板拉开对比
  const selected = [primary]
  const rest = clusters.slice(1).filter(c => distLab(c.lab, primary.lab) >= FAMILY_DIST)
  while (selected.length < PALETTE_SIZE - (primarySlots - 1) && rest.length) {
    let bestIdx = 0
    let bestScore = -1
    for (let i = 0; i < rest.length; i++) {
      const cand = rest[i]
      let minDist = Infinity
      for (const s of selected) minDist = Math.min(minDist, distLab(cand.lab, s.lab))
      const chroma = Math.hypot(cand.lab[1], cand.lab[2])
      const score = minDist * (0.6 + Math.min(chroma / 40, 1) * 0.4) * Math.pow(cand.weight, 0.25)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }
    selected.push(rest.splice(bestIdx, 1)[0])
  }
  // 槽位不足时用主色家族补齐（同 Pure-music：让主色家族占多槽）
  while (selected.length < PALETTE_SIZE) selected.push(primary)

  // accent：彩度最高的簇（供进度条/歌词高亮），灰封面自动落到最近鲜色
  let accent = clusters[0]
  let bestChroma = -1
  for (const c of clusters) {
    const chroma = Math.hypot(c.lab[1], c.lab[2]) * Math.pow(c.weight, 0.35)
    if (chroma > bestChroma) {
      bestChroma = chroma
      accent = c
    }
  }
  if (bestChroma < 7) accent = primary // 全灰封面：退回主色，避免脏色

  return {
    accent: toCss(accent.rgb),
    palette: selected.slice(0, PALETTE_SIZE).map(c => toCss(soften(c.rgb))),
    luminance: luminanceOf(accent.rgb),
  }
}

const extractFromImage = image => {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  const labs = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE * 3)
  const rgbs = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE * 3)
  const weights = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE)
  let n = 0
  for (let y = 0; y < SAMPLE_SIZE; y++) {
    for (let x = 0; x < SAMPLE_SIZE; x++) {
      const o = (y * SAMPLE_SIZE + x) * 4
      if (data[o + 3] < 125) continue // 透明像素剔除
      const nx = x / (SAMPLE_SIZE - 1)
      const ny = y / (SAMPLE_SIZE - 1)
      const dist = Math.hypot(nx - 0.5, ny - 0.5) / 0.5
      if (dist > 0.92) continue // 边缘采样权重为 0，避免边角杂色
      // 视觉中心权重 0.6~1.4
      weights[n] = 1.4 - 0.8 * dist
      rgbs[n * 3] = data[o]
      rgbs[n * 3 + 1] = data[o + 1]
      rgbs[n * 3 + 2] = data[o + 2]
      rgbToLab(data[o], data[o + 1], data[o + 2], labs, n * 3)
      n++
    }
  }
  if (n < 50) return null
  const clusters = runKmeans(labs, rgbs, weights, n)
  if (!clusters.length) return null
  return buildPalette(clusters)
}

/**
 * 提取封面调色板（k-means）
 * @param {*} image 已加载的 HTMLImageElement
 * @param {string} cacheKey 封面 URL（LRU 缓存键）
 * @returns {{accent: string, palette: string[], luminance: number} | null}
 * canvas 被远程封面污染时返回 null（调用方保留主题色回退）
 */
export const getCoverPalette = (image, cacheKey = '') => {
  if (cacheKey && cache.has(cacheKey)) {
    // LRU：命中后移到最新
    const hit = cache.get(cacheKey)
    cache.delete(cacheKey)
    cache.set(cacheKey, hit)
    return hit
  }
  let result = null
  try {
    result = extractFromImage(image)
  } catch {
    return null
  }
  if (result && cacheKey) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
    cache.set(cacheKey, result)
  }
  return result
}
