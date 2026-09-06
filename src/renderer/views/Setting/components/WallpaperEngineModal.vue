<template>
  <!-- Luminous Harmonic: teleport 必须用 #root (路由树之外) —
       之前用 #view 时, Teleport 会在 #view 里本组件根元素之后留一个锚点注释节点;
       切换大菜单时旧页卸载会移除该锚点, 而新页面挂载仍以它为插入锚点,
       导致 "insertBefore: not a child of this node" → 渲染 flush 中断 → 整页空白
       (复现: 设置→外观与主题→点任意大菜单) -->
  <material-modal :show="modelValue" bg-close teleport="#root" width="720px" max-height="86%" @close="handleClose">
    <main class="scroll" :class="$style.main">
      <header :class="$style.title">
        <h2>{{ $t('we__title') }}</h2>
      </header>
      <p :class="$style.tip">{{ $t('we__tip') }}</p>

      <div v-if="loading" :class="$style.status">{{ $t('we__scanning') }}</div>
      <template v-else>
        <div v-if="items.length" :class="$style.toolbarRow">
          <span>{{ $t('we__count', { count: items.length }) }}</span>
          <base-btn min outline @click="handleRefresh">{{ $t('netease__refresh') }}</base-btn>
        </div>
        <div v-if="items.length" class="scroll" :class="$style.grid">
          <button
            v-for="item in items" :key="item.id"
            :class="[$style.card, { [$style.active]: currentId == item.id }]"
            :aria-label="item.title" @click="handleSelect(item)"
          >
            <span :class="$style.coverWrap">
              <img v-if="item.previewUrl" :src="item.previewUrl" :class="$style.cover" loading="lazy" decoding="async" @error="$event.target.style.visibility = 'hidden'">
              <span v-else :class="$style.noCover">{{ $t('we__no_preview') }}</span>
              <span :class="$style.typeBadge">{{ typeLabel(item.projectType) }}</span>
            </span>
            <span :class="$style.cardTitle">{{ item.title }}</span>
          </button>
        </div>
        <div v-else :class="$style.status">{{ $t('we__empty') }}</div>
      </template>

      <p v-if="error" :class="$style.error">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import { getWallpaperEngineList } from '@renderer/utils/ipc'
import { applyWallpaperEngine } from '@renderer/utils/wallpaper'

export default {
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const t = useI18n()
    const loading = ref(false)
    const items = ref([])
    const error = ref('')
    const currentId = ref('')

    const typeLabel = type => ({
      video: t('we__type_video'),
      image: t('we__type_image'),
      scene: t('we__type_scene'),
      web: t('we__type_web'),
      application: t('we__type_app'),
    }[type] ?? type)

    const readCurrent = () => {
      try { currentId.value = JSON.parse(window.localStorage.getItem('lx-we-current') ?? '{}').id ?? '' } catch (_) {}
    }

    const handleLoad = async() => {
      loading.value = true
      error.value = ''
      readCurrent()
      try {
        items.value = await getWallpaperEngineList()
      } catch (err) {
        error.value = err?.message ?? t('we__load_failed')
      } finally {
        loading.value = false
      }
    }

    const handleSelect = item => {
      readCurrent()
      if (currentId.value == item.id) {
        // 再次点击取消, 恢复原背景
        applyWallpaperEngine(null)
        currentId.value = ''
        return
      }
      // Luminous Harmonic: kind 决定显示方式 — video 走视频层; image 走原图 (mediaUrl,
      // 全分辨率, 预览图是方形小图会放大模糊); scene/web 仅方形预览图 (contain 完整显示)
      const kind = item.playable
        ? (item.projectType == 'video' ? 'video' : 'image')
        : 'preview'
      applyWallpaperEngine({
        id: item.id,
        kind,
        title: item.title,
        mediaUrl: kind == 'video' || kind == 'image' ? item.mediaUrl : '',
        previewUrl: item.previewUrl || item.mediaUrl || '',
      })
      currentId.value = item.id
    }

    const handleRefresh = () => {
      void handleLoad()
    }

    const handleClose = () => emit('update:modelValue', false)

    watch(() => props.modelValue, visible => {
      if (visible) {
        items.value = []
        error.value = ''
        void handleLoad()
      }
    })

    return {
      loading,
      items,
      error,
      currentId,
      typeLabel,
      handleLoad,
      handleSelect,
      handleRefresh,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  min-height: 320px;
}
.title {
  margin-bottom: 10px;
  text-align: center;

  h2 {
    margin: 0;
    color: var(--color-primary);
    letter-spacing: 0.01em;
    word-break: break-all;
  }
}
.tip {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--color-font-label);
  text-align: center;
  line-height: 1.5;
}
.toolbarRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--color-font-label);

  span:first-child { font-variant-numeric: tabular-nums; }
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  max-height: 46vh;
  overflow-y: auto;
  padding: 8px;
  border-radius: @radius-border;
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
}
.card {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-font);
  cursor: pointer;
  text-align: left;
  transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: color-mix(in srgb, var(--color-font) 4%, transparent);
  }
  &.active {
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}
.coverWrap {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-font) 8%, transparent);
}
.cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.noCover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  font-size: 12px;
}
.typeBadge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 7px;
  border-radius: 8px;
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
}
.cardTitle {
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.status {
  padding: 14px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-font-label);
}
.error {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-danger, #e05050);
  word-break: break-all;
}
</style>
