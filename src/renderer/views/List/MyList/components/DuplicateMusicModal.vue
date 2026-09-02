<template>
  <material-modal :show="visible" bg-close teleport="#view" width="60%" max-width="900px" @close="$emit('update:visible', false)">
    <div :class="$style.header">
      <h2>{{ listName }}</h2>
    </div>
    <base-virtualized-list
      v-if="duplicateList.length" v-slot="{ item, index }" :list="duplicateList" key-name="id" :class="$style.list" style="contain: none;"
      :item-height="listItemHeight" container-class="scroll" content-class="list"
    >
      <div :class="$style.listItem">
        <div :class="$style.cover">
          <div :class="$style.coverFallback">
            <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 512 512" space="preserve">
              <use xlink:href="#icon-musicFile" />
            </svg>
          </div>
          <img
            v-if="item.musicInfo.meta.picUrl" :src="item.musicInfo.meta.picUrl" loading="lazy" decoding="async"
            :class="$style.coverImg" :aria-label="item.musicInfo.name"
            @error="$event.target.style.display = 'none'"
          >
        </div>
        <div :class="$style.textContent">
          <h3 :class="$style.text" :aria-label="item.musicInfo.name">{{ item.musicInfo.name }}</h3>
          <h3 :class="[$style.text, $style.sub]">
            <span :aria-label="item.musicInfo.singer">{{ item.musicInfo.singer }}</span>
            <template v-if="item.musicInfo.meta.albumName"> - <span :aria-label="item.musicInfo.meta.albumName">{{ item.musicInfo.meta.albumName }}</span></template>
          </h3>
        </div>
        <div class="no-select badge badge-theme-tertiary">{{ item.musicInfo.source }}</div>
        <div :class="$style.label">{{ item.musicInfo.interval }}</div>
        <div :class="$style.btns">
          <button type="button" :class="$style.btn" @click="handlePlay(index)">
            <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 287.386 287.386" space="preserve">
              <use xlink:href="#icon-testPlay" />
            </svg>
          </button>
          <button type="button" :class="$style.btn" @click="handleRemove(index)">
            <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 212.982 212.982" space="preserve">
              <use xlink:href="#icon-delete" />
            </svg>
          </button>
        </div>
      </div>
    </base-virtualized-list>
    <div v-else :class="$style.noItem">
      <p v-text="$t('no_item')" />
    </div>
  </material-modal>
</template>

<script>
import { ref, watch, computed, markRawList } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player'
import { getListMusics, removeListMusics } from '@renderer/store/list/action'
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { getFontSizeWithScreen } from '@renderer/utils'
import { LIST_IDS } from '@common/constants'
import { useI18n } from '@root/lang'

export default {
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    listInfo: { // { id: '', name: '' }
      type: Object,
      required: true,
    },
  },
  emits: ['update:visible'],
  setup(props) {
    const t = useI18n()
    const duplicateList = ref([])
    const listItemHeight = computed(() => {
      return Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 4)
    })

    const handlePlay = (index) => {
      const { index: musicInfoIndex } = duplicateList.value[index]
      playList(props.listInfo.id, musicInfoIndex)
    }
    const handleFilterList = async() => {
      // console.time('filter')
      duplicateList.value = markRawList(await window.lx.worker.main.filterDuplicateMusic(await getListMusics(props.listInfo.id)))
      // console.log(duplicateList.value)
      // console.timeEnd('filter')
    }
    const handleRemove = async(index) => {
      const { musicInfo: targetMusicInfo } = duplicateList.value.splice(index, 1)[0]
      duplicateList.value = [...duplicateList.value]
      await removeListMusics({ listId: props.listInfo.id, ids: [targetMusicInfo.id] })
      await handleFilterList()
    }

    watch(() => props.visible, (visible) => {
      if (visible) {
        if (duplicateList.value.length) duplicateList.value = []
        void handleFilterList()
      }
    })

    const listName = computed(() => {
      switch (props.listInfo.id) {
        case LIST_IDS.DEFAULT:
        case LIST_IDS.LOVE:
          return t(props.listInfo.name)

        default: return props.listInfo.name
      }
    })

    return {
      listItemHeight,
      duplicateList,
      handleFilterList,
      handleRemove,
      handlePlay,
      listName,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.header {
  flex: none;
  padding: 15px;
  text-align: center;
  h2 {
    word-break: break-all;
  }
}
.main {
  min-height: 175px;
  min-width: 380px;
  // display: flex;
  // flex-flow: column nowrap;
}

.list {
  min-height: 175px;
  min-width: 380px;
  // background-color: @color-search-form-background;
  font-size: 13px;
  transition-property: height;
  // position: relative;
  .listItem {
    position: relative;
    padding: 0 8px;
    transition: background-color .2s ease;
    line-height: 1.4;
    height: 100%;
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: 12px;
    border-radius: 8px;

    &:hover {
      background-color: color-mix(in srgb, var(--color-font) 4%, transparent);
    }
  }
}

// Luminous Harmonic: 封面缩略图 (40x40 圆角, 占位/失败回退) — 与我的列表统一
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

.textContent {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;
  gap: 3px;
  overflow: hidden;
}
.text {
  max-width: 100%;
  font-size: 14px;
  font-weight: 500;
  .mixin-ellipsis-1();
}
.sub {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.62;
}
.label {
  flex: none;
  font-size: 12px;
  opacity: 0.5;
  padding: 0 5px;
  display: flex;
  align-items: center;
  // transform: rotate(45deg);
  // background-color:
}
.btns {
  flex: none;
  font-size: 12px;
  padding: 0 5px;
  display: flex;
  align-items: center;
}
.btn {
  background-color: transparent;
  border: none;
  border-radius: @form-radius;
  margin-right: 5px;
  cursor: pointer;
  padding: 4px 7px;
  color: var(--color-button-font);
  outline: none;
  transition: background-color 0.2s ease;
  line-height: 0;
  &:last-child {
    margin-right: 0;
  }

  svg {
    height: 16px;
  }

  &:hover {
    background-color: var(--color-primary-background-hover);
  }
  &:active {
    background-color: var(--color-primary-font-active);
  }
}

.noItem {
  position: relative;
  height: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 16px;
    color: var(--color-font-label);
  }
}

</style>
