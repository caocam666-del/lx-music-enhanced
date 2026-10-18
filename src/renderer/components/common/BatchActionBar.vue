<template lang="pug">
//- Luminous Harmonic: 列表批量操作条 — 选中任意歌曲后从底部滑出,
//- 把「已选 N 首」与四个高频批量动作集中到一处, 不再依赖右键菜单逐个操作
transition(name="batch-bar")
  .batchBar(v-if="count > 0" role="toolbar" :aria-label="$t('batch__toolbar')")
    .info
      span.count {{ $t('batch__selected', { num: count }) }}
      button.clear(type="button" :aria-label="$t('batch__clear')" :title="$t('batch__clear')" @click="$emit('clear')")
        svg(viewBox="0 0 24 24" aria-hidden="true")
          use(xlink:href="#icon-close")
    .actions
      button.action(
        v-for="item in actions" :key="item.id" type="button"
        :aria-label="$t(item.labelKey)" :title="$t(item.labelKey)"
        @click="$emit('action', item.id)")
        svg(:viewBox="item.viewBox" aria-hidden="true")
          use(:xlink:href="item.icon")
        span {{ $t(item.labelKey) }}
</template>

<script>
export default {
  name: 'CommonBatchActionBar',
  props: {
    // 选中项数量（父组件传 selectedList.length）
    count: {
      type: Number,
      default: 0,
    },
  },
  emits: ['clear', 'action'],
  data() {
    return {
      actions: [
        { id: 'play-later', icon: '#icon-nextMusic', viewBox: '0 0 1024 1024', labelKey: 'batch__play_later' },
        { id: 'add-to', icon: '#icon-list-add', viewBox: '0 0 42 42', labelKey: 'batch__add_to' },
        { id: 'collect', icon: '#icon-love', viewBox: '0 0 1024 1024', labelKey: 'batch__collect' },
        { id: 'download', icon: '#icon-download-2', viewBox: '0 0 1024 1024', labelKey: 'batch__download' },
      ],
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.batchBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  padding: 8px 14px;
  margin: 0 8px 6px;
  border-radius: 12px;
  // 玻璃风：与列表卡片一致，但用主色描边表示「有选中」
  background: color-mix(in srgb, var(--color-primary) 12%, var(--glass-card, transparent));
  border: 1px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  backdrop-filter: blur(8px);
  color: var(--color-font);
}

.info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

.clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 3px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-font-label);
  cursor: pointer;
  transition: color .2s ease, background-color .2s ease;

  svg { width: 100%; height: 100%; fill: currentColor; }
  &:hover { color: var(--color-font); background: color-mix(in srgb, var(--color-font) 12%, transparent); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-font);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color .2s ease, color .2s ease;

  svg {
    flex: none;
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  &:hover {
    background: color-mix(in srgb, var(--color-primary) 22%, transparent);
    color: var(--color-primary);
  }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
}

// 从底部滑出的入场
.batch-bar-enter-active,
.batch-bar-leave-active {
  transition: opacity .18s ease, transform .18s cubic-bezier(.2, 0, 0, 1);
}
.batch-bar-enter-from,
.batch-bar-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .batch-bar-enter-active,
  .batch-bar-leave-active { transition: none; }
}

@media (max-width: 900px) {
  .action span { display: none; }
  .action { padding: 6px; }
}
</style>
