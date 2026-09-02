<template>
  <Modal :show="visible" :close-btn="false" :teleport="teleport" @close="handleCancel" @after-leave="afterLeave">
    <main class="scroll" :class="[$style.main, { 'select': selection }]">{{ message }}</main>
    <footer :class="$style.footer">
      <Btn v-if="showCancel" :class="$style.btn" @click="handleCancel">{{ cancelBtnText }}</Btn>
      <Btn :class="$style.btn" @click="handleComfirm">{{ confirmBtnText }}</Btn>
    </footer>
  </Modal>
</template>

<script>
import Modal from '@renderer/components/material/Modal.vue'
import Btn from '@renderer/components/base/Btn.vue'
import { useI18n } from '@renderer/plugins/i18n'
import { computed } from '@common/utils/vueTools'
export default {
  components: {
    Modal,
    Btn,
  },
  props: {
    afterLeave: {
      type: Function,
      default: () => {},
    },
  },
  setup() {
    const t = useI18n()

    const defaultBtnTexts = computed(() => {
      return {
        confirm: t('confirm_button_text'),
        cancel: t('cancel_button_text'),
      }
    })

    return {
      defaultBtnTexts,
    }
  },
  data() {
    return {
      visible: false,
      message: '',
      showCancel: false,
      cancelButtonText: '',
      confirmButtonText: '',
      teleport: '#root',
      selection: false,
    }
  },
  computed: {
    cancelBtnText() {
      return this.cancelButtonText || this.defaultBtnTexts.cancel
    },
    confirmBtnText() {
      return this.confirmButtonText || this.defaultBtnTexts.confirm
    },
  },
  beforeUnmount() {
    // Modal 内的 <transition> 已自己管 DOM 卸载，无需手动 removeChild
  },
  methods: {
    handleCancel() {
    },
    handleComfirm() {
    },
  },
}
</script>

<style lang="less" module>

.main {
  flex: auto;
  min-height: 40px;
  padding: 20px 20px 0;
  font-size: 14px;
  min-width: 240px;
  line-height: 1.6;
  white-space: pre-line;
  color: var(--color-font);
  text-align: center;
}

.footer {
  flex: none;
  padding: 15px 20px;
  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
  gap: 12px;
}
</style>
