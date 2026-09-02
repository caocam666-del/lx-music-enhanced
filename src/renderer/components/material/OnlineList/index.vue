<template>
  <div :class="$style.songList">
    <!-- <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut"> -->
    <div :class="$style.list">
      <!-- Luminous Harmonic: 列表内工具行 — 搜索栏 + 定位当前播放歌曲 (与我的列表统一) -->
      <div v-show="list.length && !noItem" :class="$style.toolbar">
        <div :class="$style.searchBox">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
          </svg>
          <input v-model="filterKey" type="text" :placeholder="$t('list__search_tip')" :aria-label="$t('list__search')">
          <button v-show="filterKey" :class="$style.clearBtn" type="button" :aria-label="$t('setting__search_clear')" @click="filterKey = ''">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
              <use xlink:href="#icon-close" />
            </svg>
          </button>
        </div>
        <button :class="$style.locateBtn" type="button" :disabled="!locateEnabled" :title="$t('list__locate_playing')" :aria-label="$t('list__locate_playing')" @click="locatePlaying">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
          </svg>
        </button>
      </div>
      <div :class="$style.content">
        <div v-show="!noItem && displayList.length" ref="dom_listContent" :class="$style.content">
          <base-virtualized-list v-if="actionButtonsVisible" ref="listRef" :list="displayList" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item }">
                              <div
                  class="list-item" :class="[{ selected: rightClickSelectedIndex == getIndex(item) }, { active: playingId == item.id }]"
                  @click="handleListItemClick($event, getIndex(item))" @contextmenu="handleListItemRightClick($event, getIndex(item))"
                >
                  <div :class="$style.cover">
                    <div :class="$style.coverFallback">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 512 512" space="preserve">
                        <use xlink:href="#icon-musicFile" />
                      </svg>
                    </div>
                    <img
                      v-if="item.meta.picUrl" :src="item.meta.picUrl" loading="lazy" decoding="async"
                      :class="$style.coverImg" :aria-label="item.name"
                      @error="$event.target.style.display = 'none'"
                    >
                    <div v-if="playingId == item.id" :class="$style.playingBadge">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 287.386 287.386" space="preserve">
                        <use xlink:href="#icon-play" />
                      </svg>
                    </div>
                  </div>
                  <div :class="$style.info">
                    <div :class="$style.name">
                      <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                      <span v-if="item.meta._qualitys.flac24bit" class="no-select badge badge-theme-primary">{{ $t('tag__lossless_24bit') }}</span>
                      <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                      <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                      <span v-if="sourceTag" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
                    </div>
                    <div :class="$style.sub">
                      <span class="select" :aria-label="item.singer">{{ item.singer }}</span>
                      <span v-if="item.meta.albumName" class="select"> - {{ item.meta.albumName }}</span>
                    </div>
                  </div>
                  <span :class="$style.interval">{{ item.interval || '--/--' }}</span>
                  <div :class="$style.buttons">
                    <material-list-buttons :index="getIndex(item)" :remove-btn="false" :download-btn="assertApiSupport(item.source)" :play-btn="checkApiSource ? assertApiSupport(item.source) : true" @btn-click="handleListBtnClick" />
                  </div>
                </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
          <base-virtualized-list v-else ref="listRef" :list="displayList" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item }">
                              <div
                  class="list-item" :class="[{ selected: rightClickSelectedIndex == getIndex(item) }, { active: playingId == item.id }]"
                  @click="handleListItemClick($event, getIndex(item))" @contextmenu="handleListItemRightClick($event, getIndex(item))"
                >
                  <div :class="$style.cover">
                    <div :class="$style.coverFallback">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 512 512" space="preserve">
                        <use xlink:href="#icon-musicFile" />
                      </svg>
                    </div>
                    <img
                      v-if="item.meta.picUrl" :src="item.meta.picUrl" loading="lazy" decoding="async"
                      :class="$style.coverImg" :aria-label="item.name"
                      @error="$event.target.style.display = 'none'"
                    >
                    <div v-if="playingId == item.id" :class="$style.playingBadge">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 287.386 287.386" space="preserve">
                        <use xlink:href="#icon-play" />
                      </svg>
                    </div>
                  </div>
                  <div :class="$style.info">
                    <div :class="$style.name">
                      <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                      <span v-if="item.meta._qualitys.flac24bit" class="no-select badge badge-theme-primary">{{ $t('tag__lossless_24bit') }}</span>
                      <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                      <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                      <span v-if="sourceTag" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
                    </div>
                    <div :class="$style.sub">
                      <span class="select" :aria-label="item.singer">{{ item.singer }}</span>
                      <span v-if="item.meta.albumName" class="select"> - {{ item.meta.albumName }}</span>
                    </div>
                  </div>
                  <span :class="$style.interval">{{ item.interval || '--/--' }}</span>
                </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
        </div>
        <div v-show="noItem || (!displayList.length && filterKey)" :class="$style.noitem">
          <p v-text="noItem || $t('no_item')" />
        </div>
      </div>
    </div>
    <!-- </transition> -->
    <!-- <material-flow-btn :show="isShowEditBtn && assertApiSupport(source)" :remove-btn="false" @btn-click="handleFlowBtnClick" /> -->
    <!-- <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" /> -->
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <common-list-add-multiple-modal v-model:show="isShowListAddMultiple" :music-list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { ref, computed } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useMusicActions from './useMusicActions'
import { appSetting } from '@renderer/store/setting'
export default {
  name: 'MaterialOnlineList',
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    page: {
      type: Number,
      required: true,
    },
    limit: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    sourceTag: {
      type: Boolean,
      default: false,
    },
    noItem: {
      type: String,
      default: '',
    },
    checkApiSource: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['show-menu', 'play-list', 'togglePage'],
  setup(props, { emit }) {
    const actionButtonsVisible = appSetting['list.actionButtonsVisible']
    const rightClickSelectedIndex = ref(-1)
    const dom_listContent = ref(null)
    const listRef = ref(null)

    // Luminous Harmonic: 列表内搜索过滤 + 当前行定位 (与我的列表统一) —
    // displayList 为过滤后的展示列表, 交互索引经 getIndex 映射回原始列表
    const filterKey = ref('')
    const displayList = computed(() => {
      const key = filterKey.value.toLowerCase()
      if (!key) return props.list
      return props.list.filter(item =>
        item.name.toLowerCase().includes(key) ||
        item.singer.toLowerCase().includes(key) ||
        (item.meta.albumName || '').toLowerCase().includes(key),
      )
    })
    const indexMap = computed(() => {
      const map = new Map()
      props.list.forEach((item, i) => map.set(item, i))
      return map
    })
    const getIndex = item => indexMap.value.get(item) ?? -1
    const playingId = computed(() => playMusicInfo.musicInfo?.id ?? null)
    const locateEnabled = computed(() => displayList.value.some(item => item.id === playingId.value))
    const locatePlaying = () => {
      const idx = displayList.value.findIndex(item => item.id === playingId.value)
      if (idx > -1) listRef.value?.scrollToIndex(idx, -Math.round(listItemHeight.value * 1.5), true)
    }

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
    } = useList({ props, listRef })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ selectedList, props, removeAllSelect, emit })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, props })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, props })

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleDislikeMusic,
    } = useMusicActions({ props })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      props,
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleSearch,
      handleShowMusicAddModal,
      handleOpenMusicDetail,
      handleDislikeMusic,
    })

    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, props.list[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }
    const handleListRightClick = (event) => {
      if (!event.target.classList.contains('select')) return
      event.stopImmediatePropagation()
      let classList = dom_listContent.value.classList
      classList.add('copying')
      window.requestAnimationFrame(() => {
        let str = window.getSelection().toString()
        classList.remove('copying')
        str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
        if (!str.length) return
        clipboardWriteText(str)
      })
    }
    const handleListBtnClick = ({ action, index }) => {
      switch (action) {
        case 'download':
          handleShowDownloadModal(index, true)
          break
        case 'play':
          void handlePlayMusic(index, true)
          break
        case 'search':
          handleSearch(index)
          break
        case 'listAdd':
          handleShowMusicAddModal(index, true)
          break
      }
    }
    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    return {
      listItemHeight,
      handleListItemClick,
      selectedList,
      handleListItemRightClick,
      removeAllSelect,
      handleListBtnClick,
      rightClickSelectedIndex,
      dom_listContent,
      listRef,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,
      actionButtonsVisible,

      filterKey,
      displayList,
      getIndex,
      playingId,
      locateEnabled,
      locatePlaying,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Luminous Harmonic: Pure-music 风格卡片行 (与我的列表统一)
.cover {
  position: relative;
  flex: none;
  width: 44px;
  height: 44px;
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
  background: color-mix(in srgb, var(--color-primary) 45%, transparent);
  color: #fff;
}
.buttons {
  flex: none;
  display: flex;
  align-items: center;
}
.toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px 10px;
}
.searchBox {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-content-background) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
  transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:focus-within { border-color: color-mix(in srgb, var(--color-primary) 45%, transparent); }

  svg { flex: none; width: 14px; height: 14px; fill: var(--color-font-label); }

  input {
    flex: 1 1 auto;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    font-size: 13px;
    color: var(--color-font);

    &::placeholder { color: var(--color-font-label); }
  }
}
.clearBtn {
  flex: none;
  width: 16px;
  height: 16px;
  padding: 2px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-font-label);
  svg { width: 100%; height: 100%; fill: currentColor; }
  &:hover { color: var(--color-primary); }
}
.locateBtn {
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-content-background) 60%, transparent);
  color: var(--color-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  svg { width: 16px; height: 16px; fill: currentColor; }
  &:hover:not(:disabled) { background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
  &:disabled { opacity: .4; cursor: default; }
}
.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 4px;
}
.info .name {
  display: flex;
  align-items: baseline;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.25;
  overflow: hidden;
  white-space: nowrap;
  span:first-child { overflow: hidden; text-overflow: ellipsis; }
}
.sub {
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-font-label);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.interval {
  flex: none;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--color-font-label);
}


.songList {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

// Luminous Harmonic: Pure-music 风格卡片行 — 覆盖全局玻璃行样式 (与我的列表统一)
.list {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  font-size: 14px;

  :global(.list-item) {
    background: transparent;
    box-shadow: none;
    border-radius: 8px;
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: 12px;
    padding: 0 8px;
    height: 100%;
    transition: background-color 280ms cubic-bezier(0.4, 0, 0.2, 1), border-color 280ms cubic-bezier(0.4, 0, 0.2, 1), color 280ms cubic-bezier(0.4, 0, 0.2, 1), transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;

    &:hover:not(.active) {
      background: color-mix(in srgb, var(--color-font) 4%, transparent);
      transform: none;
    }
    // 当前播放行: 主色胶囊 + 描边 + 歌名主色
    &.active {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
      color: var(--color-primary);
    }
  }
}

.content {
  flex: auto;
  min-height: 0;
  position: relative;
  height: 100%;
}

.pagination {
  text-align: center;
  padding: 15px 0;
  // left: 50%;
  // transform: translateX(-50%);
}
.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  // background-color: var(--color-000);

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

</style>
