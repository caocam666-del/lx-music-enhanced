<template>
  <ul :class="[$style.list, $style[align]]" role="tablist">
    <li
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, {[$style.active]: modelValue == item[itemKey]}]" tabindex="-1" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" @click="handleToggle(item[itemKey])"
    >
      <span :class="$style.label">{{ item[itemLabel] }}</span>
    </li>
  </ul>
</template>

<script>

export default {
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    align: {
      type: String,
      default: 'left',
    },
    itemKey: {
      type: String,
      default: 'id',
    },
    itemLabel: {
      type: String,
      default: 'label',
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const handleToggle = id => {
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
    }

    return {
      handleToggle,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  display: flex;
  flex-flow: row nowrap;
  font-size: 12px;
  gap: 8px;
  padding: 0 15px;

  &.left {
    justify-content: flex-start;
  }
  &.center {
    justify-content: center;
  }
  &.right {
    justify-content: flex-end;
  }
}
.listItem {
  display: block;
  cursor: pointer;
  // Luminous Harmonic: tab 标签 glass-card 药丸化
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid var(--glass-stroke, transparent);
  background-color: transparent;
  transition: color @transition-normal, background-color @transition-normal, border-color @transition-normal;


  &:hover {
    color: var(--color-primary);
    // Luminous Harmonic: 统一透明度公式 (乘全局 --glass-alpha)
    background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
    border-color: var(--glass-stroke-strong, var(--glass-stroke, transparent));
  }


  &.active {
    color: var(--color-primary);
    font-weight: 700;
    cursor: default;
    // Luminous Harmonic: 统一透明度公式 (乘全局 --glass-alpha)
    background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
    border-color: var(--color-primary-alpha-300, var(--glass-stroke-strong));

    >.label {
      &:after {
        display: none;
      }
    }
  }
}

.label {
  display: block;
  position: relative;
  padding: 0;
  &:after {
    .mixin-after();
    left: 0;
    bottom: 0;
    width: 100%;
    height: 2px;
    border-radius: 20px;
    background-color: transparent;
    transform: translateY(-4px);
    opacity: 0;
    background-color: var(--color-primary-alpha-300);
    transition: @transition-fast;
    transition-property: transform, opacity;
  }
}
</style>
