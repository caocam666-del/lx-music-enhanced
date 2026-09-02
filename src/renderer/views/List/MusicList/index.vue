<template>
  <div :class="$style.list">
    <!-- Luminous Harmonic: 歌单内工具行 — 搜索栏 + 定位当前播放歌曲 -->
    <div v-show="list.length" :class="$style.toolbar">
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
      <button :class="$style.locateBtn" type="button" :disabled="!playerInfo.isPlayList" :title="$t('list__locate_playing')" :aria-label="$t('list__locate_playing')" @click="locatePlaying">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
        </svg>
      </button>
    </div>
    <!-- Luminous Harmonic: Pure-music 风格歌单列表 — 封面 + 两行文字 + 时长, 无表头 -->
    <div v-show="displayList.length" ref="dom_listContent" :class="$style.content">
      <base-virtualized-list v-if="actionButtonsVisible" ref="listRef" :list="displayList" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
        <template #default="{ item }">
          <div
            class="list-item" :class="[{ selected: rightClickSelectedIndex == getIndex(item) || selectedIndex == getIndex(item) }, { active: playerInfo.isPlayList && playerInfo.playIndex == getIndex(item) }]"
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
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex == getIndex(item)" :class="$style.playingBadge">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 287.386 287.386" space="preserve">
                  <use xlink:href="#icon-play" />
                </svg>
              </div>
            </div>
            <div :class="$style.info">
              <div :class="$style.name">
                <span class="select" :aria-label="item.name">{{ item.name }}</span>
                <span v-if="item.meta._qualitys && (item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav || item.meta._qualitys.flac24bit)" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                <span v-if="isShowSource" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
              </div>
              <div :class="$style.sub">
                <span class="select" :aria-label="item.singer">{{ item.singer }}</span>
                <span v-if="item.meta.albumName" class="select"> - {{ item.meta.albumName }}</span>
              </div>
            </div>
            <span :class="$style.interval">{{ item.interval || '--/--' }}</span>
            <div :class="$style.buttons">
              <material-list-buttons :index="getIndex(item)" :remove-btn="false" :download-btn="assertApiSupport(item.source)" @btn-click="handleListBtnClick" />
            </div>
          </div>
        </template>
      </base-virtualized-list>
      <base-virtualized-list v-else ref="listRef" :list="displayList" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
        <template #default="{ item }">
          <div
            class="list-item" :class="[{ selected: rightClickSelectedIndex == getIndex(item) || selectedIndex == getIndex(item) }, { active: playerInfo.isPlayList && playerInfo.playIndex == getIndex(item) }]"
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
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex == getIndex(item)" :class="$style.playingBadge">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 287.386 287.386" space="preserve">
                  <use xlink:href="#icon-play" />
                </svg>
              </div>
            </div>
            <div :class="$style.info">
              <div :class="$style.name">
                <span class="select" :aria-label="item.name">{{ item.name }}</span>
                <span v-if="item.meta._qualitys && (item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav || item.meta._qualitys.flac24bit)" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                <span v-if="isShowSource" class="no-select badge badge-theme-tertiary">{{ item.source }}</span>
              </div>
              <div :class="$style.sub">
                <span class="select" :aria-label="item.singer">{{ item.singer }}</span>
                <span v-if="item.meta.albumName" class="select"> - {{ item.meta.albumName }}</span>
              </div>
            </div>
            <span :class="$style.interval">{{ item.interval || '--/--' }}</span>
          </div>
        </template>
      </base-virtualized-list>
    </div>
    <div v-show="!displayList.length" :class="$style.noItem">
      <p v-text="$t('no_item')" />
    </div>
    <common-list-add-modal
      v-model:show="isShowListAdd" :is-move="isMove" :from-list-id="listId"
      :music-info="selectedAddMusicInfo" :exclude-list-id="excludeListIds" teleport="#view"
    />
    <common-list-add-multiple-modal
      v-model:show="isShowListAddMultiple" :from-list-id="listId"
      :is-move="isMoveMultiple" :music-list="selectedList" :exclude-list-id="excludeListIds" teleport="#view" @confirm="removeAllSelect"
    />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" :list-id="listId" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" :list-id="listId" @confirm="removeAllSelect" />
    <search-list :list="list" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <music-sort-modal v-model:show="isShowMusicSortModal" :music-info="selectedSortMusicInfo" :selected-num="selectedNum" @confirm="sortMusic" />
    <music-toggle-modal v-model:show="isShowMusicToggleModal" :music-info="selectedToggleMusicInfo" @toggle="toggleSource" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import SearchList from './components/SearchList.vue'
import MusicSortModal from './components/MusicSortModal.vue'
import MusicToggleModal from './components/MusicToggleModal.vue'
import useListInfo from './useListInfo'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useSort from './useSort'
import useMusicActions from './useMusicActions'
import useSearch from './useSearch'
import useListScroll from './useListScroll'
import useMusicToggle from './useMusicToggle'
import { appSetting } from '@renderer/store/setting'
export default {
  name: 'MusicList',
  components: {
    SearchList,
    MusicSortModal,
    MusicToggleModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
  },
  emits: ['show-menu'],
  setup(props, { emit }) {
    const actionButtonsVisible = appSetting['list.actionButtonsVisible']

    let scrollIndex = null
    let isAnimation = false
    const handleRestoreScroll = (_scrollIndex, _isAnimation) => {
      scrollIndex = _scrollIndex
      isAnimation = _isAnimation
      if (isAnimation) void restoreScroll(scrollIndex, isAnimation)
      // console.log('handleRestoreScroll', scrollIndex, isAnimation)
    }
    const onLoadedList = () => {
      // console.log('restoreScroll', scrollIndex, isAnimation)
      void restoreScroll(scrollIndex, isAnimation)
    }

    const {
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      list,
      playerInfo,
      setSelectedIndex,
      isShowSource,
      excludeListIds,
    } = useListInfo({ props, onLoadedList })

    // Luminous Harmonic: 歌单内搜索 (客户端过滤) + 索引映射 —
    // displayList 为过滤后的展示列表; 所有交互索引通过 getIndex 映射回原始列表
    // eslint-disable-next-line @typescript-eslint/no-redeclare -- 模板使用, vue+ts-eslint 组合误报
    const filterKey = ref('')
    // eslint-disable-next-line @typescript-eslint/no-redeclare -- 模板使用, vue+ts-eslint 组合误报
    const displayList = computed(() => {
      const key = filterKey.value.toLowerCase()
      if (!key) return list.value
      return list.value.filter(item =>
        item.name.toLowerCase().includes(key) ||
        item.singer.toLowerCase().includes(key) ||
        (item.meta.albumName || '').toLowerCase().includes(key),
      )
    })
    const indexMap = computed(() => {
      const map = new Map()
      list.value.forEach((item, i) => map.set(item, i))
      return map
    })
    // eslint-disable-next-line @typescript-eslint/no-redeclare, @typescript-eslint/no-unused-vars -- 模板使用, 误报
    const getIndex = item => indexMap.value.get(item) ?? -1
    // eslint-disable-next-line @typescript-eslint/no-redeclare, @typescript-eslint/no-unused-vars -- 模板使用, 误报
    const locatePlaying = () => {
      if (!playerInfo.value.isPlayList) return
      const displayIdx = displayList.value.indexOf(list.value[playerInfo.value.playIndex])
      if (displayIdx < 0) return
      listRef.value?.scrollToIndex(displayIdx, -Math.round(listItemHeight.value * 1.5), true)
    }


    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
    } = useList({ listRef, list })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ props, selectedList, list, removeAllSelect })

    const {
      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
    } = useMusicAdd({ selectedList, list })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, list })

    const {
      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      handleShowSortModal,
      sortMusic,
    } = useSort({ props, list, selectedList, removeAllSelect })

    const {
      handleShowMusicToggleModal,
      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    } = useMusicToggle(props, list)

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    } = useMusicActions({ props, list, removeAllSelect, selectedList })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleShowMusicToggleModal,
      handleSearch,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
      handleShowSortModal,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    })

    const {
      isShowSearchBar,
      searchList,
      handleMusicSearchAction,
    } = useSearch({
      setSelectedIndex,
      handlePlayMusic,
      listRef,
    })

    const { saveListPosition, restoreScroll } = useListScroll({ props, listRef, list, handleRestoreScroll })


    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, list.value[index], index)
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
          handlePlayMusic(index, true)
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
      selectedIndex,
      dom_listContent,
      listRef,
      excludeListIds,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,

      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      sortMusic,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,

      isShowSearchBar,
      searchList,
      handleMusicSearchAction,

      list,
      displayList,
      filterKey,
      getIndex,
      locatePlaying,
      playerInfo,

      saveListPosition,
      isShowSource,
      handleRestoreScroll,

      actionButtonsVisible,

      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;

  // Luminous Harmonic: Pure-music 风格卡片行 — 覆盖全局玻璃行样式 (行透明, 高亮为胶囊)
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
    // 当前播放行: 主色 8% 胶囊 + 主色 35% 描边 + 歌名主色 (Pure-music AudioTile)
    &.active {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
      color: var(--color-primary);

      .label-source { color: var(--color-primary); opacity: .78; }
    }
  }
  :global {
    .label-source {
      color: var(--color-primary);
      padding: 0 0 0 6px;
      font-size: .8em;
      line-height: 1.2;
      opacity: .75;
      display: inline-block;
    }
  }
}

// Luminous Harmonic: 封面缩略图 (44x44 圆角, 含占位/加载失败回退/播放徽章)
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
.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 4px;
}
.name {
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
.content {
  min-height: 0;
  font-size: 14px;
  display: flex;
  flex-flow: column nowrap;
  flex: auto;
}

.noItem {
  position: relative;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

</style>
