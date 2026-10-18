<template>
  <div
    ref="dom_island"
    tabindex="0"
    role="application"
    :aria-label="musicInfo.name || 'Lyrics island'"
    :class="[$style.island, { [$style.expanded]: isExpanded }]"
    :style="islandStyles"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleIslandClick"
    @contextmenu.prevent="handleContextMenu"
    @keydown="handleKeydown"
  >
    <!-- 流光背景 + 拾音器（在内容之下，圆角由 .island 裁切） -->
    <IslandFlowBg />

    <!-- 收起态 ↔ 展开态：交叉淡入 + 轻微上移。
         不用 Vue 的 <transition> —— CSS Modules 会把 `islandView-enter-from`
         这类裸选择器一并哈希，Vue 按字符串拼出的类名匹配不到规则，动画静默失效。
         改为「状态切换时重挂载 + 纯 CSS 动画」：给 <template> 换 key，强制重挂载，
         @keyframes 才会重放（否则 Vue 同位 patch 复用元素，切换显得很突兀）。 -->
    <template v-if="!isExpanded" key="view-capsule">
      <!-- ======================= 收起态：胶囊 ======================= -->
      <div :class="[$style.capsule, $style.capsuleIn]">
        <!-- 封面缩略图 -->
        <div v-if="showCover" :class="$style.miniCoverWrap">
          <img v-if="musicInfo.pic" :src="musicInfo.pic" :class="$style.miniCover" alt="" draggable="false" />
          <div v-else :class="[$style.miniCover, $style.coverEmpty]">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
            </svg>
          </div>
        </div>

        <!-- 歌名（右侧接歌手）+ 当前歌词行（换行时上滑滚动） -->
        <div :class="$style.miniText">
          <div :class="[$style.miniTitleRow, 'nobreak']">
            <span :class="$style.miniTitle">{{ musicInfo.name || '暂无歌曲' }}</span>
            <span v-if="musicInfo.singer" :class="$style.miniSinger">{{ musicInfo.singer }}</span>
          </div>
          <div :class="[$style.miniLyricClip, 'nobreak']">
            <transition name="miniLyricRoll" mode="out-in">
              <div :key="'ml' + lyric.line" :class="[$style.miniLyric, { [$style.miniLyricPlain]: !currentSegments.length }]">
                <template v-if="currentSegments.length">
                  <span
                    v-for="(segment, index) in currentSegments"
                    :key="index"
                    :class="$style.word"
                    :style="{ '--word-progress': segment.progress * 100 + '%' }"
                  >{{ segment.text }}</span>
                </template>
                <template v-else>{{ miniSubText }}</template>
              </div>
            </transition>
          </div>
        </div>

        <!-- 胶囊下沿迷你进度（本地时钟驱动，真实推进） -->
        <div :class="$style.miniTrack" aria-hidden="true">
          <div :class="$style.miniBar" :style="{ width: progressRatio * 100 + '%' }" />
        </div>

        <!-- 边缘拖拽调宽：仅在「手动点击展开」模式下出现；鼠标移到边缘变左右箭头 -->
        <template v-if="showResizeHandles">
          <span
            :class="[$style.resizeHandle, $style.resizeLeft]"
            role="separator"
            aria-label="拖动调整胶囊长度"
            @mousedown.stop.prevent="startResize('left', $event)"
          />
          <span
            :class="[$style.resizeHandle, $style.resizeRight]"
            role="separator"
            aria-label="拖动调整胶囊长度"
            @mousedown.stop.prevent="startResize('right', $event)"
          />
        </template>
      </div>
    </template>

    <template v-else key="view-card">
      <!-- ======================= 展开态：播放卡 ======================= -->
      <div :class="[$style.card, $style.cardIn]">
        <!-- 第一行：左侧「封面 + 歌名/歌手 + 播放控制」 │ 右侧滚动歌词 -->
        <div :class="$style.cardMain">
          <div :class="$style.infoBlock">
            <!-- 封面 + 歌曲信息：一行；其正下方是播放控制 -->
            <div :class="$style.infoRow">
              <div :class="$style.coverWrap">
                <img v-if="musicInfo.pic" :src="musicInfo.pic" :class="$style.cover" alt="" draggable="false" />
                <div v-else :class="[$style.cover, $style.coverEmpty]">
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div :class="$style.meta">
                <div :class="[$style.songName, 'nobreak']" :title="musicInfo.name">{{ musicInfo.name || '暂无歌曲' }}</div>
                <div :class="[$style.singer, 'nobreak']" :title="musicInfo.singer">{{ musicInfo.singer || '\u00a0' }}</div>
              </div>
            </div>

            <!-- 播放控制：位于封面/歌名/歌手正下方；
                 取色与详情页同源，并按卡片底色做对比度兜底（详见 --island-ctrl-color） -->
            <div :class="$style.controls">
              <button type="button" :class="$style.ctrlBtn" :aria-label="$t('player__prev')" :title="$t('player__prev')" @click.stop="handlePrev">
                <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-prevMusic" /></svg>
              </button>
              <button type="button" :class="[$style.ctrlBtn, $style.ctrlMain]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" :title="isPlay ? $t('player__pause') : $t('player__play')" @click.stop="handleToggle">
                <svg v-if="isPlay" viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-pause" /></svg>
                <svg v-else viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-play" /></svg>
              </button>
              <button type="button" :class="$style.ctrlBtn" :aria-label="$t('player__next')" :title="$t('player__next')" @click.stop="handleNext">
                <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-nextMusic" /></svg>
              </button>
            </div>
          </div>

          <!-- 滚动歌词：整列一起上移一行（旧句从顶部滑出、新句从底部顶上）
               对齐可切换；点击跳转；滚轮调字号 -->
          <div
            ref="dom_lyric_area"
            :class="[$style.lyricArea, $style['align' + lyricAlignSuffix]]"
            role="group"
            :aria-label="'歌词，滚轮可调整字号'"
            @wheel="handleWheel"
          >
            <div :class="$style.lrcViewport">
              <!--
                歌词切换用「纯淡入淡出」：三行位置固定不动，只做透明度过渡。
                为什么不滚动：3 行视口里滚 1 行，中途必然出现"2 行完整 + 上下各半行"，
                观感上就是"往上顶成两行"。:key 绑定当前行号 → 换行时整块重建，
                重新播放 fade-in 动画，位置完全不动。
              -->
              <div :key="lyric.line" :class="$style.lrcTrack">
                <button
                  v-for="row in rows"
                  :key="row.offset"
                  type="button"
                  :class="[
                    $style.lrcRow,
                    row.active ? $style.lrcActive : (row.offset < 0 ? $style.lrcPrev : $style.lrcNext),
                    { [$style.lrcClickable]: row.time > 0 },
                    { [$style.lrcSolidActive]: row.active && !row.segments.length },
                  ]"
                  :disabled="!(row.time > 0)"
                  :title="row.time > 0 ? `跳转到 ${formatTime(row.time / 1000)}` : ''"
                  @click.stop="handleRowClick(row)"
                >
                  <template v-if="row.segments.length">
                    <span
                      v-for="(segment, index) in row.segments"
                      :key="index"
                      :class="$style.word"
                      :style="{ '--word-progress': segment.progress * 100 + '%' }"
                    >{{ segment.text }}</span>
                  </template>
                  <template v-else>{{ row.text || '\u00a0' }}</template>
                </button>
              </div>
            </div>
            <div v-if="!rows.length" :class="[$style.lrcRow, $style.lrcEmpty]">
              {{ musicInfo.id ? '暂无歌词' : '暂无歌曲' }}
            </div>
          </div>
        </div>

        <!-- 第二行：进度条 —— 独占整行，横跨整个卡片。
             data-island-static：点击/拖动这里不应切换展开态（见 handleIslandClick） -->
        <div :class="$style.progressRow" data-island-static>
          <IslandProgress
            :progress="progressRatio"
            :wave="playBarWave"
            :playing="isPlay"
            :now-time="progress.now / 1000"
            :max-time="progress.max / 1000"
            @seek="handleSeek"
          />
        </div>
      </div>
    </template>


    <!-- 右键菜单 -->
    <div v-if="isShowCtx" ref="dom_ctx" :class="$style.ctx" @mousedown.stop @mouseleave="handleCtxLeave" @click.stop>
      <button type="button" @click="cycleTrigger">{{ $t('island__trigger') }}：{{ triggerLabel }}</button>
      <button type="button" @click="handleResetPosition">{{ $t('island__reset_position') }}</button>
      <button type="button" @click="cycleDock">{{ $t('island__dock') }}：{{ dockLabel }}</button>
      <button type="button" @click="cycleFlowMode">{{ $t('island__flow') }}：{{ flowLabel }}</button>
      <button type="button" @click="cycleLyricAlign">歌词对齐：{{ lyricAlignLabel }}</button>
      <button type="button" @click="toggleLock">{{ setting['desktopLyric.isLock'] ? $t('island__unlock') : $t('island__lock') }}</button>
      <button type="button" @click="closeLyric">{{ $t('island__close') }}</button>
    </div>
  </div>
</template>

<script>
import { computed, ref, nextTick, onBeforeUnmount, onMounted, watch } from '@common/utils/vueTools'
import { setting, musicInfo, isPlay } from '@lyric/store/state'
import { lyric } from '@lyric/store/lyric'
import { progress, markSeek } from '@lyric/store/progress'
import { detailColors } from '@lyric/store/detailColors'
import { updateSetting, resetIslandPosition, setIslandExpanded, setIslandContentWidth, onIslandCursorLeave } from '@lyric/utils/ipc'
import { sendPlayerAction } from '@lyric/core/mainWindowChannel'
import { computeControlColor } from '@renderer/utils/detailAccent'
import useIslandLyric from './useIslandLyric'
import IslandProgress from './IslandProgress.vue'
import IslandFlowBg from './IslandFlowBg.vue'

const DOCKS = ['top', 'bottom', 'left', 'right']
const DOCK_LABEL = {
  bottom: '底部',
  top: '顶部',
  left: '左侧',
  right: '右侧',
}
const TRIGGERS = ['hover', 'click']
const TRIGGER_LABEL = { hover: '悬停展开', click: '点击展开' }
const FLOW_MODES = ['dynamic', 'rhythm', 'none']
const FLOW_LABEL = { dynamic: '动态流光', rhythm: '节奏律动', none: '纯净' }
const ALIGNS = ['left', 'center', 'right']
const ALIGN_LABEL = { left: '左对齐', center: '居中', right: '右对齐' }

export default {
  name: 'LyricIsland',
  components: { IslandProgress, IslandFlowBg },
  setup() {
    const dom_island = ref(null)
    const dom_lyric_area = ref(null)
    const dom_ctx = ref(null)
    const isShowCtx = ref(false)

    // ---- 滚动歌词窗口（收起态单行 + 展开态 N 行）----
    const {
      rows,
      currentLineText,
      currentSegments,
    } = useIslandLyric()

    /*
     * 展开态歌词切换：**纯淡入淡出，三行位置完全不动**。
     *
     * 这里刻意不做"整列上移"的滚动：3 行视口里滚 1 行，中途必然出现
     * 「2 行完整 + 上下各半行」，观感就是"往上顶成两行、再变回三行"。
     * 现在三行槽位固定，换行时靠模板上的 :key="lyric.line" 整块重建，
     * 重播一次 fade-in（见 .lrcTrack 的 animation），因此永远不会出现半行。
     */

    const lyricLineText = computed(() => currentLineText.value)
    // 收起态第二行：当前歌词行 → 退化为歌手 → 再退化为提示
    const miniSubText = computed(() => {
      const line = currentLineText.value
      if (line) return line
      if (musicInfo.singer) return musicInfo.singer
      return musicInfo.id ? '暂无歌词' : '暂无歌曲'
    })
    const showCover = computed(() => setting['desktopLyric.island.showCover'] !== false)

    // ---- 展开 / 收起状态机 ----
    const isExpanded = ref(false)
    let hoverTimer = 0
    let leaveTimer = 0
    const clearTimers = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = 0 }
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = 0 }
    }
    const setExpanded = (expanded) => {
      if (isExpanded.value === expanded) return
      isExpanded.value = expanded
      setIslandExpanded(expanded)
    }
    const triggerMode = computed(() => setting['desktopLyric.island.expandTrigger'] ?? 'hover')
    const handleMouseEnter = () => {
      if (triggerMode.value != 'hover') return
      clearTimers()
      hoverTimer = setTimeout(() => {
        hoverTimer = 0
        setExpanded(true)
      }, Math.max(0, setting['desktopLyric.island.hoverDelay'] ?? 120))
    }
    const handleMouseLeave = () => {
      if (triggerMode.value != 'hover') return
      clearTimers()
      leaveTimer = setTimeout(() => {
        leaveTimer = 0
        setExpanded(false)
      }, Math.max(0, setting['desktopLyric.island.leaveDelay'] ?? 900))
    }
    const handleIslandClick = (event) => {
      // 按钮是控件，不参与「点击展开/收起」
      if (event.target.closest('button')) return
      /**
       * 进度条、进度条拖动热区等「交互区」也不能触发收起。
       *
       * 之前只排除了 button，而进度条是 div —— 在「点击展开」模式下，
       * 点一下进度条会冒泡到根节点被当成"点了空白处"，直接把卡片收成胶囊。
       * 这里用 data-island-static 显式标记所有不该切换展开态的区块。
       */
      if (event.target.closest('[data-island-static]')) return
      if (triggerMode.value == 'click') setExpanded(!isExpanded.value)
      else if (!isExpanded.value) setExpanded(true)
    }
    onIslandCursorLeave(() => {
      if (triggerMode.value != 'hover') return
      clearTimers()
      setExpanded(false)
    })
    onBeforeUnmount(clearTimers)

    // ---- 播放进度（本地时钟，真实推进；详见 store/progress.ts）----
    const playBarWave = computed(() => setting['common.playBarWave'] !== false)
    const progressRatio = computed(() => progress.ratio || 0)
    const formatTime = (sec) => {
      sec = Math.max(0, Math.floor(sec || 0))
      const m = Math.floor(sec / 60)
      const s = sec % 60
      return `${m}:${s < 10 ? '0' : ''}${s}`
    }
    const nowTimeStr = computed(() => formatTime(progress.now / 1000))
    const maxTimeStr = computed(() => formatTime(progress.max / 1000))

    // ---- 播放控制 / 跳转 ----
    const handleToggle = () => { sendPlayerAction('toggle') }
    const handlePrev = () => { sendPlayerAction('prev') }
    const handleNext = () => { sendPlayerAction('next') }
    /**
     * 拖动/点击进度条 → 跳转。
     *
     * 两处加固：
     *  1. 总时长未知时不提交（ratio × 0 = 0 会变成"跳到开头"）
     *  2. 提交前先 markSeek 把显示位置定到目标并挂起纠偏，否则主窗随后推来的
     *     跳转前位置会把进度条弹回原地（用户反馈"怎么点都跳回原地"）
     */
    const handleSeek = (ratio) => {
      const max = progress.max
      if (!max || max <= 0) return
      const target = Math.max(0, Math.min(1, ratio)) * max
      if (!Number.isFinite(target)) return
      markSeek(target)
      sendPlayerAction('seek', target)
    }
    // 点歌词行 → 跳到该行时间（行不可点/无时间时是 disabled，不会触发）
    const handleRowClick = (row) => {
      if (!(row.time > 0)) return
      sendPlayerAction('seek', row.time)
    }

    // ---- 滚轮调字号（限幅 + 防抖持久化，避免滚轮高频写配置）----
    const MIN_FONT = 11
    const MAX_FONT = 26
    let fontSaveTimer = 0
    const handleWheel = (event) => {
      const delta = event.deltaY > 0 ? -1 : 1
      const current = Number(setting['desktopLyric.island.lyricFontSize']) || 15
      const next = Math.max(MIN_FONT, Math.min(MAX_FONT, current + delta))
      if (next === current) return
      // 立即改本地值让界面即时响应，再防抖持久化
      setting['desktopLyric.island.lyricFontSize'] = next
      if (fontSaveTimer) clearTimeout(fontSaveTimer)
      fontSaveTimer = setTimeout(() => {
        fontSaveTimer = 0
        void updateSetting({ 'desktopLyric.island.lyricFontSize': next })
      }, 400)
    }
    onBeforeUnmount(() => { if (fontSaveTimer) clearTimeout(fontSaveTimer) })

    // ---- 样式 ----
    // 控件取色：与详情页同源（--detail-accent-bright），但按卡片实际底色做对比度兜底，
    // 保证深色 accent 落在暗卡上时图标不会「隐形」（用户要求：始终清晰可见）。
    const controlColor = computed(() => computeControlColor({
      accent: detailColors.accent,
      // 卡片底 = 底色叠 0.70 黑色蒙层，实测合成后约在 rgb(50,47,55) 一档；
      // 取略亮于此的参考值更保守（对更亮的底也满足对比度）
      cardBackground: 'rgb(58, 55, 64)',
    }))

    const islandStyles = computed(() => ({
      // 不透明度只作用于流光层，避免整层相乘导致越调越淡
      fontFamily: setting['desktopLyric.style.font'] ?? undefined,
      '--island-font-size': `${setting['desktopLyric.island.lyricFontSize'] ?? 15}px`,
      // 歌词行固定行高：让整个歌词列的高度恒定。
      // 否则「当前行变大 + 上下行变小」会让列高变化，容器 justify-content:center
      // 每换一行就整体重排一次，看起来又跳又生硬。
      '--island-row-h': `calc(${setting['desktopLyric.island.lyricFontSize'] ?? 15}px * 1.6)`,
      // 歌词视口行数：整列上移需要一个固定高度、能裁切多余行的视口
      '--island-lines': String(Math.max(1, setting['desktopLyric.island.lyricLines'] ?? 3)),
      // 灵动岛背景不透明度：独立设置（0-100），只作用于背景流光层。
      // 文字不跟着变透明 —— 否则调低时会整片糊掉看不清。
      '--island-surface-opacity': String(Math.max(0.15, Math.min(1, (setting['desktopLyric.island.opacity'] ?? 100) / 100))),
      '--island-ctrl-color': controlColor.value,
    }))

    // ---- 右键菜单 ----
    /**
     * 把焦点移到菜单第一项。
     *
     * 两个坑：
     *  1. 用 preventScroll —— 岛本体是 overflow:hidden 的小窗口，而菜单渲染在岛外侧；
     *     浏览器为「把焦点元素滚进视野」会把 .island 的 scrollTop 拉起来（实测 123px），
     *     卡片内容随之被滚出可视区，看起来就像「展开后一片空白」。
     *  2. 即使 preventScroll，仍兜底把 scrollTop 归零。
     */
    const focusFirstAction = () => {
      void nextTick(() => {
        const btn = dom_ctx.value?.querySelector('button')
        btn?.focus({ preventScroll: true })
        resetIslandScroll()
      })
    }
    /** 关闭菜单时也把可能残留的内部滚动复位 */
    const resetIslandScroll = () => {
      const el = dom_island.value
      // 岛本体是 overflow:hidden 的小窗口；焦点滚动会把它滚下去，必须复位
      if (el?.scrollTop) el.scrollTop = 0
    }

    // ---- 胶囊宽度：按「整首最长句」定宽 ----
    //
    // 为什么不再跟着当前行变：用户反馈「每句歌词都会改变胶囊长度」很难看。
    // 现在改成换歌时算一次「这首歌最长的一句」，整首固定，切歌再重算。
    // 用 canvas.measureText 量文字（不依赖 DOM、不触发重排，几百行也只有毫秒级开销）。
    let measureTimer = 0
    let lastReported = 0
    let measureCtx = null
    const CAPSULE_PADDING = 24 // .capsule 左右 padding 各 12
    const CAPSULE_COVER = 30 // .miniCoverWrap 宽度
    const CAPSULE_GAP = 9 // .capsule gap
    const CAPSULE_SLACK = 8 // 预留余量，避免最后几个字被裁
    /** 与主进程 ISLAND_AUTO_MIN / MAX 保持一致 */
    const WIDTH_MIN = 168
    const WIDTH_MAX = 420

    const textWidth = (text, font) => {
      if (!text) return 0
      if (typeof document == 'undefined') return 0
      if (!measureCtx) {
        const canvas = document.createElement('canvas')
        measureCtx = canvas.getContext('2d')
      }
      if (!measureCtx) return 0
      measureCtx.font = font
      return measureCtx.measureText(text).width
    }

    const measureSongWidth = () => {
      const fontSize = Number(setting['desktopLyric.island.lyricFontSize']) || 15
      const family = setting['desktopLyric.style.font'] || 'sans-serif'
      // 歌词行按当前行字重（700）量，取上界；标题行是 .78em
      const lyricFont = `700 ${fontSize}px ${family}`
      const titleFont = `600 ${Math.round(fontSize * 0.78)}px ${family}`

      // 1) 整首歌最长的一句（去掉逐字时间戳）
      let widestLyric = 0
      const lines = lyric.lines
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]?.rawText ?? lines[i]?.text ?? ''
        if (!raw) continue
        const plain = raw.replace(/<\d+,\d+>/g, '')
        const w = textWidth(plain, lyricFont)
        if (w > widestLyric) widestLyric = w
      }

      // 2) 歌名 + 歌手（收起态第一行）
      let titleW = textWidth(musicInfo.name || '', titleFont)
      if (musicInfo.singer) titleW += 6 + textWidth(musicInfo.singer, titleFont)

      const contentW = Math.max(widestLyric, titleW)
      if (!contentW) return // 还没歌词也没歌名，保持原样

      const coverW = showCover.value ? CAPSULE_COVER + CAPSULE_GAP : 0
      const total = Math.round(contentW + coverW + CAPSULE_PADDING + CAPSULE_SLACK)
      const clamped = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, total))
      if (Math.abs(clamped - lastReported) < 4) return
      lastReported = clamped
      setIslandContentWidth(clamped)
    }

    /** 合并高频变化（歌词可能分多批推来），250ms 内只量一次 */
    const scheduleMeasure = () => {
      clearTimeout(measureTimer)
      measureTimer = setTimeout(measureSongWidth, 250)
    }
    onMounted(() => {
      void nextTick(() => { scheduleMeasure() })
    })
    // 换歌 / 歌词载入 / 字号与封面显隐变化时才重算；**不跟 lyric.line**（否则又变成逐句变宽）
    watch(() => [
      musicInfo.id,
      musicInfo.name,
      musicInfo.singer,
      lyric.lines.length,
      setting['desktopLyric.island.lyricFontSize'],
      setting['desktopLyric.style.font'],
      showCover.value,
    ], scheduleMeasure)
    onBeforeUnmount(() => { clearTimeout(measureTimer) })

    // ---- 边缘拖拽调宽 ----
    // 只在「手动点击展开」模式下启用：此时鼠标本来就不会因悬停切换状态，
    // 边缘可以安全地作为拖拽热区（光标变成左右箭头）。
    const showResizeHandles = computed(() => setting['desktopLyric.island.expandTrigger'] === 'click')

    let resizeState = null
    const startResize = (side, event) => {
      if (!showResizeHandles.value) return
      const startWidth = window.innerWidth
      const startX = event.screenX
      let lastSent = startWidth
      let sendTimer = 0
      resizeState = { side, startWidth, startX }

      const apply = (width) => {
        const w = Math.max(180, Math.min(520, Math.round(width)))
        if (Math.abs(w - lastSent) < 2) return
        lastSent = w
        // 手动拖拽 = 明确要固定宽度：同时关掉「按内容自适应」，
        // 否则下一次换歌又被最长句覆盖回去。配置变更后主进程会重新摆放窗口。
        void updateSetting({
          'desktopLyric.island.autoWidth': false,
          'desktopLyric.island.width': w,
        })
      }

      const onMove = (ev) => {
        const dx = ev.screenX - startX
        // 窗口是按中心定位的：拖动右边缘 dx 像素，宽度变化 2dx；左边缘方向相反
        const delta = side === 'right' ? dx * 2 : -dx * 2
        clearTimeout(sendTimer)
        // 节流：每 60ms 最多写一次配置，避免拖动时疯狂触发 IPC
        sendTimer = setTimeout(() => { apply(startWidth + delta) }, 0)
      }
      const onUp = () => {
        clearTimeout(sendTimer)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        resizeState = null
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    const handleContextMenu = () => {
      isShowCtx.value = true
      focusFirstAction()
    }
    const handleCtxLeave = () => {
      isShowCtx.value = false
      resetIslandScroll()
    }
    const closeCtx = () => {
      isShowCtx.value = false
      resetIslandScroll()
    }
    const handleResetPosition = () => {
      resetIslandPosition({ expanded: isExpanded.value })
      closeCtx()
    }
    const cycleDock = () => {
      const current = setting['desktopLyric.island.dock'] ?? 'top'
      const next = DOCKS[(DOCKS.indexOf(current) + 1) % DOCKS.length]
      setting['desktopLyric.island.dock'] = next
      void updateSetting({ 'desktopLyric.island.dock': next })
      resetIslandPosition({ dock: next, expanded: isExpanded.value })
    }
    const dockLabel = computed(() => DOCK_LABEL[setting['desktopLyric.island.dock'] ?? 'top'])
    const cycleTrigger = () => {
      const current = setting['desktopLyric.island.expandTrigger'] ?? 'hover'
      const next = TRIGGERS[(TRIGGERS.indexOf(current) + 1) % TRIGGERS.length]
      setting['desktopLyric.island.expandTrigger'] = next
      void updateSetting({ 'desktopLyric.island.expandTrigger': next })
    }
    const triggerLabel = computed(() => TRIGGER_LABEL[setting['desktopLyric.island.expandTrigger'] ?? 'hover'])
    const cycleFlowMode = () => {
      const current = setting['desktopLyric.island.flowMode'] ?? 'dynamic'
      const next = FLOW_MODES[(FLOW_MODES.indexOf(current) + 1) % FLOW_MODES.length]
      setting['desktopLyric.island.flowMode'] = next
      void updateSetting({ 'desktopLyric.island.flowMode': next })
    }
    const flowLabel = computed(() => FLOW_LABEL[setting['desktopLyric.island.flowMode'] ?? 'dynamic'])

    // 歌词对齐：左 / 居中 / 右（右键菜单切换，设置页也有）
    const lyricAlign = computed(() => setting['desktopLyric.island.lyricAlign'] ?? 'left')
    /** 样式类名后缀：alignLeft / alignCenter / alignRight */
    const lyricAlignSuffix = computed(() => {
      const a = lyricAlign.value
      return a === 'center' ? 'Center' : a === 'right' ? 'Right' : 'Left'
    })
    const cycleLyricAlign = () => {
      const current = lyricAlign.value
      const next = ALIGNS[(ALIGNS.indexOf(current) + 1) % ALIGNS.length]
      setting['desktopLyric.island.lyricAlign'] = next
      void updateSetting({ 'desktopLyric.island.lyricAlign': next })
    }
    const lyricAlignLabel = computed(() => ALIGN_LABEL[lyricAlign.value] ?? ALIGN_LABEL.left)

    const toggleLock = () => {
      const next = !setting['desktopLyric.isLock']
      setting['desktopLyric.isLock'] = next
      void updateSetting({ 'desktopLyric.isLock': next })
      closeCtx()
    }
    const closeLyric = () => {
      setting['desktopLyric.enable'] = false
      void updateSetting({ 'desktopLyric.enable': false })
      closeCtx()
    }

    // ---- 键盘 ----
    const handleKeydown = event => {
      if (event.key == 'Escape') {
        closeCtx()
        if (isExpanded.value && triggerMode.value == 'click') setExpanded(false)
        return
      }
      if (event.key == 'Enter' || event.key == ' ') {
        event.preventDefault()
        if (triggerMode.value == 'click') setExpanded(!isExpanded.value)
        else {
          isShowCtx.value = !isShowCtx.value
          if (isShowCtx.value) focusFirstAction()
        }
      }
    }

    return {
      dom_island,
      dom_lyric_area,
      dom_ctx,
      isShowCtx,
      setting,
      musicInfo,
      showResizeHandles,
      startResize,
      isPlay,
      progress,
      lyric,
      rows,
      currentLineText,
      currentSegments,
      lyricLineText,
      miniSubText,
      showCover,
      islandStyles,
      isExpanded,
      triggerMode,
      handleMouseEnter,
      handleMouseLeave,
      handleIslandClick,
      playBarWave,
      progressRatio,
      nowTimeStr,
      maxTimeStr,
      formatTime,
      handleToggle,
      handlePrev,
      handleNext,
      handleSeek,
      handleRowClick,
      handleWheel,
      handleContextMenu,
      handleCtxLeave,
      handleResetPosition,
      cycleDock,
      dockLabel,
      cycleTrigger,
      triggerLabel,
      cycleFlowMode,
      flowLabel,
      lyricAlign,
      lyricAlignSuffix,
      cycleLyricAlign,
      lyricAlignLabel,
      toggleLock,
      closeLyric,
      handleKeydown,
    }
  },
}
</script>

<style lang="less" module>
@import '@lyric/assets/styles/layout.less';

// Luminous Harmonic: 岛本体 — 圆角药丸，无直角。
// 背景由 IslandFlowBg 负责（底色 + 流光 + 蒙层），这里只做圆角裁切与栅格。
.island {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  overflow: hidden;
  color: var(--detail-font-bright, var(--lyric-text, var(--color-font)));
  border: 1px solid var(--glass-stroke, rgba(255, 255, 255, .12));
  user-select: none;
  // 药丸 → 卡片：圆角从「半高圆形」平滑收到 18px，配合内容的形变过渡
  // 与主进程窗口尺寸补间同一条曲线、同一时长，两块动效才不会互相错位
  transition: border-radius @island-dur @island-ease;

  &:focus-visible { outline: 2px solid var(--detail-accent-bright, var(--color-primary)); outline-offset: 2px; }
}

// 展开态：药丸变成播放卡（圆角收小，换成两行栅格）
.island.expanded {
  border-radius: 18px;
}

// ---------------- 形变过渡 ----------------
// 窗口尺寸由主进程瞬间切换（透明窗无法用 CSS 过渡窗口大小），
// 所以用「内容形变」来制造"自然长出来"的观感。
//
// 改用纯 CSS 动画（状态切换时元素重挂载 → 动画随之播放）。
// 不用 Vue <transition>：CSS Modules 会把 `islandView-enter-from` 这类裸选择器
// 一并哈希，Vue 按字符串拼出的类名匹配不到规则，动画会静默失效（已实测踩坑）。
// 只动 opacity + transform，不做非整数缩放（避免文字发虚、看起来卡顿）。
@island-ease: cubic-bezier(.22, 1, .36, 1);
// 与主进程 ISLAND_MORPH_MS 严格一致：窗口长大与内容形变必须同起同落
@island-dur: .3s;

.capsuleIn {
  animation: island-capsule-in @island-dur @island-ease both;
  will-change: transform, opacity;
}
.cardIn {
  animation: island-card-in @island-dur @island-ease both;
  transform-origin: center top;
  will-change: transform, opacity;
}
// 收起：内容略微缩小 + 淡出，像被吸回胶囊
@keyframes island-capsule-in {
  from { opacity: 0; transform: scale(.98); }
  to { opacity: 1; transform: scale(1); }
}
// 展开：内容从略小 + 略高位置「长开」，与窗口尺寸补间同步
// （只用很小的缩放比，既保留"从胶囊里抽出来"的感觉，又不会明显糊字）
@keyframes island-card-in {
  from { opacity: 0; transform: scale(.965) translateY(-2%); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .capsuleIn, .cardIn { animation: none; }
}

// ---------------- 收起态：胶囊 ----------------
.capsule {
  position: relative;
  z-index: 1;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 9px;
  height: 100%;
  padding: 0 12px;
  box-sizing: border-box;
}

.miniCoverWrap {
  position: relative;
  flex: none;
  width: 30px;
  height: 30px;
}
.miniCover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.miniText {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 1px;
}
// 第一行：歌名 + 歌手（歌手紧接歌名右侧，次要色）
.miniTitleRow {
  display: flex;
  flex-flow: row nowrap;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: .78em;
  line-height: 1.15;
  opacity: .8;
  text-shadow: var(--color-lyric-shadow, var(--detail-lyric-shadow, none));
}
.miniTitle {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.miniSinger {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: .72;
  font-size: .92em;

  &::before {
    content: '·';
    margin-right: 4px;
    opacity: .6;
  }
}
.miniLyric {
  font-size: 1em;
  line-height: 1.2;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: var(--color-lyric-shadow, var(--detail-lyric-shadow, none));
}

// 收起态歌词：容器裁切 + 纵向滚动动画
// 只做「上滑」——参考 Pure-music 顶部歌词切换：旧行上移淡出、新行自下方升入。
.miniLyricClip {
  position: relative;
  overflow: hidden;
  min-width: 0;
  height: 1.2em;
}
@mini-roll-dur: .34s;
@mini-roll-ease: cubic-bezier(.22, 1, .36, 1);

// 必须包 :global —— CSS Modules 会哈希裸类名，Vue 按字面量加类，两者匹配不上
:global {
  .miniLyricRoll-enter-active,
  .miniLyricRoll-leave-active {
    transition: transform @mini-roll-dur @mini-roll-ease, opacity @mini-roll-dur @mini-roll-ease;
    will-change: transform, opacity;
  }
  .miniLyricRoll-enter-from {
    opacity: 0;
    transform: translateY(100%);
  }
  .miniLyricRoll-leave-to {
    opacity: 0;
    transform: translateY(-100%);
  }
  .miniLyricRoll-leave-active {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .miniLyricRoll-enter-active,
    .miniLyricRoll-leave-active { transition: none; }
  }
}

// 逐行歌词（无字级时间戳）时，整行同样取详情页强调色。
// 依据：详情页 `&.line-mode.active .font-lrc` 与 `&.font-mode.active .font-lrc`
// 是**同一条规则**，都取 var(--detail-accent-bright)。所以逐行/逐字都该上色，
// 这样收起态胶囊、展开态卡片、任务栏歌词与详情页四者一致。
// 例外：没有曲目信息（未开始播放）时不取色，避免"暂无歌词"占位也被染色。
.miniLyricPlain {
  // 统一取色入口：默认跟随详情页，用户手动改色后由 useTheme 解析成自定义色
  color: var(--color-lyric-played, var(--detail-accent-bright, var(--color-font)));
}

// 收起态下沿迷你进度：本地时钟驱动
.miniTrack {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 4px;
  height: 2px;
  border-radius: 1px;
  background: rgb(255 255 255 / .16);
  overflow: hidden;
  z-index: 1;
}
// 边缘拖拽热区：只在「手动点击展开」模式渲染。
// 光标为左右箭头，提示可以拖动调宽。
.resizeHandle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: ew-resize;
  z-index: 3;
  // 视觉上不显示，只提供热区与光标
  background: transparent;

  // 悬停时给一条细提示线，让"可拖拽"这件事可见
  &:hover::after {
    content: '';
    position: absolute;
    top: 22%;
    bottom: 22%;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: color-mix(in srgb, var(--detail-font-bright, #fff) 55%, transparent);
  }
}
.resizeLeft { left: 0; }
.resizeRight { right: 0; }

.miniBar {
  height: 100%;
  border-radius: 1px;
  background: var(--detail-accent-bright, var(--color-primary));
  transition: width .2s linear;
}

// ---------------- 展开态：播放卡 ----------------
// 两行栅格：第一行「歌曲信息 │ 歌词」，第二行「播放控制 │ 通栏进度」。
// 各区域有独立位置，互不挤压；所有文本 min-width:0 + 省略号，长内容不吃邻居空间。
.card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  // 底部留 12px：进度条 18px 高，若仍用 8px 会被挤出卡片内容区
  // （表现为进度条贴在最外沿、且点击命中被判到卡片之外）
  padding: 10px 14px 12px;
  gap: 6px;
}

.cardMain {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 12px;
}

// 左块：上「封面 + 歌名/歌手」，下「播放控制」（纵向两块）
.infoBlock {
  flex: none;
  width: 186px;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 7px;
}

// 封面与歌曲信息同一行
.infoRow {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.coverWrap {
  flex: none;
  width: 52px;
  height: 52px;
}
.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}
.coverEmpty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--island-ctrl-color, var(--color-primary)) 22%, transparent);
  color: var(--island-ctrl-color, var(--color-primary));
}

.meta {
  flex: 1 1 auto;
  min-width: 0;
}
.songName {
  font-size: 1em;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: var(--color-lyric-shadow, var(--detail-lyric-shadow, none));
}
.singer {
  font-size: .76em;
  opacity: .72;
  line-height: 1.3;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 右块：滚动歌词（N 行，当前行放大）
.lyricArea {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 0;
  overflow: hidden;
}

// ---------------- 歌词滚动：整列上移（复刻 TaskbarLyrics 的上划观感）----------------
// 视口固定为 N 行高并裁切；内部的 .lrcTrack 由 JS 用 transform 上移 k 行。
// 这样换行时旧首行会完整地从顶部滑出、新行从底部顶上，是一个连续动作，
// 而不是"旧行瞬间消失、新行自己滑入"。
.lrcViewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  height: calc(var(--island-row-h, 24px) * var(--island-lines, 3));
  // 让首尾被裁切的行不会露出半行阴影/焦点环
  contain: paint;
  /**
   * 这里**不要**加 mask-image 上下淡出。
   *
   * 之前加了 14%/86% 的淡出遮罩，静止时首尾两行就被洗淡了一半；
   * 滚动途中"正在被顶出/正在进入"的那两行几乎整行落在淡出区里，
   * 于是中途看起来像"只剩两行，然后才跳回三行"（用户反馈）。
   * overflow:hidden 本身就会干净裁切，滚动时露出半行反而是自然的。
   */
}

.lrcTrack {
  display: flex;
  flex-flow: column nowrap;
  gap: 0;
  min-width: 0;
  // 换行时整块重建（模板 :key="lyric.line"）→ 重播淡入。位置固定，不做位移动画。
  animation: island-line-fade .22s ease both;
}

@keyframes island-line-fade {
  from { opacity: .3; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .lrcTrack { animation: none !important; }
}

// 歌词对齐：左 / 居中 / 右（右键菜单或设置页切换）
.alignLeft .lrcRow { text-align: left; }
.alignCenter .lrcRow { text-align: center; }
.alignRight .lrcRow { text-align: right; }

.lrcRow {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: var(--island-font-size, 15px);
  // 行高与固定高度一致：行高等恒定，换行时容器不会整体重排（这是"生硬"的主因）
  height: var(--island-row-h, 24px);
  line-height: var(--island-row-h, 24px);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
  // 只过渡取色与字号：transform/opacity 交给翻页动画，避免两者互相拖慢
  transition: color .22s ease, font-size .26s ease, opacity .26s ease;
}
.lrcPrev,
.lrcNext {
  opacity: .40;
  font-size: calc(var(--island-font-size, 15px) * .82);
}
.lrcActive {
  font-weight: 700;
  opacity: 1;
  text-shadow: var(--color-lyric-shadow, var(--detail-lyric-shadow, none));
}
// 无逐字数据时，当前行整行取详情页强调色。
// 详情页 .line-mode.active .font-lrc 就是 color: var(--detail-accent-bright)，
// 这里保持一致，避免"正在播放的歌词颜色和详情页对不上"。
.lrcSolidActive {
  color: var(--color-lyric-played, var(--detail-accent-bright, var(--color-primary)));
}
.lrcClickable {
  cursor: pointer;
  &:hover { opacity: .92; }
  &:focus-visible { outline: 1px solid var(--detail-accent-bright, var(--color-primary)); outline-offset: 1px; }
}
.lrcEmpty { opacity: .45; }

// 逐字高亮：已唱用详情页强调色，未唱用详情页中性文字色（与歌词详情页同源）
.word {
  background-image: linear-gradient(
    to right,
    var(--color-lyric-played, var(--detail-accent-bright, var(--color-primary))) 0,
    var(--color-lyric-played, var(--detail-accent-bright, var(--color-primary))) var(--word-progress, 0%),
    color-mix(in srgb, var(--color-lyric-unplay, var(--detail-font-bright, var(--color-font))) 76%, transparent) var(--word-progress, 0%),
    color-mix(in srgb, var(--color-lyric-unplay, var(--detail-font-bright, var(--color-font))) 76%, transparent) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

// 播放控制：位于「封面 + 歌名/歌手」正下方，靠左与封面左缘对齐
.controls {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

// 播放控制：纯色图标，无背景块。
// 取色 = 详情页 accentBright 经对比度兜底（--island-ctrl-color），保证暗卡上始终可见；
// 若兜底值缺失则回退到详情页色，再回退主题色。
.ctrlBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--island-ctrl-color, var(--detail-accent-bright, var(--color-primary)));
  cursor: pointer;
  transition: transform .16s ease, filter .16s ease;

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
    // 图标本身加一层极轻描边式投影，压在任何封面色上都保持轮廓
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / .45));
  }
  &:hover {
    transform: scale(1.14);
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--island-ctrl-color, var(--color-primary)) 65%, transparent));
  }
  &:active { transform: scale(.94); }
  &:focus-visible { outline: 2px solid var(--island-ctrl-color, var(--color-primary)); outline-offset: 1px; }
}
// 主按钮不带底色，靠尺寸区分
.ctrlMain {
  width: 30px;
  height: 30px;
}

// 第三行：进度条独占整行 —— 直接横跨卡片内容宽度（左右仅留卡片内边距）
.progressRow {
  flex: none;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
}

// 右键菜单
// 右键菜单：渲染在岛「内部」（岛是 overflow:hidden 的小窗口），
// 若挂在岛外侧，浏览器为把焦点滚进视野会拉起 .island 的 scrollTop，
// 卡片内容被滚出可视区（表现为「展开后一片空白」）。
.ctx {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  flex-flow: column nowrap;
  min-width: 148px;
  max-height: calc(100% - 12px);
  overflow-y: auto;
  padding: 4px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--luminous-bg-base, #16171c) 92%, transparent);
  border: 1px solid var(--glass-stroke, rgb(255 255 255 / .12));
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 28px rgb(0 0 0 / .42);

  button {
    padding: 5px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;

    &:hover { background: rgb(255 255 255 / .12); }
    &:focus-visible { outline: 2px solid var(--detail-accent-bright, var(--color-primary)); outline-offset: -2px; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .island, .lrcRow, .ctrlBtn, .miniBar { transition: none; }
}
</style>
