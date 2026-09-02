<template lang="pug">
  div(:class="$style.container")
    header(:class="$style.header")
      h3 {{ $t('player__detail_view_playlist') }}
      span(v-if="list.length" :class="$style.count") {{ list.length }}
    div(:class="$style.listWrap")
      base-virtualized-list(v-if="list.length" ref="listRef" v-slot="{ item, index }" :list="list" key-name="id" :item-height="60" container-class="scroll" content-class="list")
        div(:class="[$style.row, { [$style.active]: index == playIndex }]" :aria-label="getName(item)" @dblclick="play(index)")
          div(:class="$style.cover")
            div(:class="$style.coverFallback")
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 512 512" space="preserve")
                use(xlink:href="#icon-musicFile")
            img(v-if="getPic(item)" :src="getPic(item)" loading="lazy" decoding="async" :class="$style.coverImg" :aria-label="getName(item)" @error="$event.target.style.display = 'none'")
            div(v-if="index == playIndex" :class="$style.playingBadge")
              span(:class="$style.playingBars")
                i
                i
                i
          div(:class="$style.info")
            div(:class="$style.name")
              span {{ getName(item) }}
            div(:class="$style.sub")
              span {{ getSinger(item) }}
              template(v-if="getAlbum(item)") &nbsp;- {{ getAlbum(item) }}
          span(:class="$style.interval") {{ getInterval(item) || '--/--' }}
      div(v-else :class="$style.noItem")
        p(v-text="$t('no_item')")
</template>

<script>
// Luminous Harmonic: 详情页右栏"播放列表"视图 — 卡片样式与我的列表统一
// (封面 + 歌名/歌手·专辑两行 + 时长, 当前行封面叠加声量条)。列表数据沿用
// useListInfo 的"ref + 事件刷新"模式 (allMusicList 为 markRaw 非响应 Map)。
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { playInfo } from '@renderer/store/player/state'
import { getListMusicsFromCache } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'

export default {
  name: 'DetailPlaylist',
  setup() {
    const listRef = ref(null)
    const list = ref([])
    const playIndex = computed(() => playInfo.playerPlayIndex)

    const loadList = () => {
      list.value = [...getListMusicsFromCache(playInfo.playerListId)]
    }

    const scrollToCurrent = () => {
      void nextTick(() => {
        if (playIndex.value < 0 || !listRef.value) return
        const container = listRef.value.$el
        const centerOffset = container ? Math.round(container.clientHeight * 0.38 - 30) : 0
        listRef.value.scrollToIndex(playIndex.value, -centerOffset)
      })
    }

    watch(() => playInfo.playerListId, () => {
      loadList()
      scrollToCurrent()
    }, { immediate: true })

    const handleMyListUpdate = ids => {
      if (!playInfo.playerListId || ids.includes(playInfo.playerListId)) loadList()
    }
    window.app_event.on('myListUpdate', handleMyListUpdate)

    onMounted(scrollToCurrent)
    onBeforeUnmount(() => {
      window.app_event.off('myListUpdate', handleMyListUpdate)
    })

    const play = index => {
      if (playInfo.playerListId == null) return
      playList(playInfo.playerListId, index)
    }

    // 队列项可能是下载列表项（metadata.musicInfo 包裹）
    const getMusicInfo = item => ('progress' in item ? item.metadata.musicInfo : item)
    const getName = item => getMusicInfo(item).name
    const getSinger = item => getMusicInfo(item).singer
    const getAlbum = item => getMusicInfo(item).meta?.albumName || ''
    const getPic = item => getMusicInfo(item).meta?.picUrl || ''
    const getInterval = item => getMusicInfo(item).interval || ''

    return {
      listRef,
      list,
      playIndex,
      play,
      getName,
      getSinger,
      getAlbum,
      getPic,
      getInterval,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  width: min(100%, 820px);
  height: 100%;
  margin: 0 auto;
  font-size: 14px;
}
.header {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 8px 10px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--detail-font-bright, var(--color-font));
    text-shadow: var(--detail-font-shadow, none);
  }
}
.count {
  font-size: 12px;
  color: var(--detail-font-bright, var(--color-font));
  opacity: .7;
  text-shadow: var(--detail-font-shadow, none);
}
// Luminous Harmonic: 虚拟列表容器 — flex:1 + min-height:0 让内部 height:100% 的滚动容器正确收缩
.listWrap {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--detail-font-bright, var(--color-font));
  text-shadow: var(--detail-font-shadow, none);
  cursor: pointer;
  transition: background-color @motion-base @ease-standard, border-color @motion-base @ease-standard, color @motion-base @ease-standard;

  &:hover:not(.active) {
    background: color-mix(in srgb, var(--color-font) 4%, transparent);
  }
  &.active {
    color: var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary)));
    background: color-mix(in srgb, var(--detail-accent-color, var(--color-primary)) 8%, transparent);
    border-color: color-mix(in srgb, var(--detail-accent-color, var(--color-primary)) 35%, transparent);
  }
}
// Luminous Harmonic: 封面缩略图 (40x40 圆角, 占位/失败回退/播放徽章) — 与我的列表统一
.cover {
  position: relative;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-font) 8%, transparent);
}
.coverFallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  opacity: .65;

  svg { fill: currentColor; }
}
.coverImg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.playingBadge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--detail-accent-color, var(--color-primary)) 55%, transparent);
  color: #fff;
}
.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 3px;
}
.name {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sub {
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  opacity: .72;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.interval {
  flex: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  opacity: .7;
}

// Luminous Harmonic: 正在播放行 — 三根跳动的声量条（Pure-music 风格指示器）
.playingBars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;

  i {
    width: 3px;
    border-radius: 1px;
    background: currentColor;
    animation: playing-bar 1s ease-in-out infinite;
    &:nth-child(1) { height: 60%; }
    &:nth-child(2) { height: 100%; animation-delay: .25s; }
    &:nth-child(3) { height: 45%; animation-delay: .5s; }
  }
}
@keyframes playing-bar {
  0%, 100% { transform: scaleY(.5); }
  50% { transform: scaleY(1); }
}

.noItem {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  font-size: 14px;
  opacity: .72;
}
</style>
