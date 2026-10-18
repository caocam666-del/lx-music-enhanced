<template lang="pug">
//- Luminous Harmonic: 播放诊断浮层 —— 播放/换源失败时, 可查看「试过哪些音源、各自结果与耗时」
transition(name="diag")
  .diag(v-if="show" role="dialog" :aria-label="$t('diag__title')")
    header
      span.title {{ $t('diag__title') }}
      button.close(type="button" :aria-label="$t('diag__close')" :title="$t('diag__close')" @click="$emit('close')")
        svg(viewBox="0 0 24 24" aria-hidden="true")
          use(xlink:href="#icon-close")
    .meta
      span.line {{ d.title || $t('diag__no_song') }}
      span.line {{ $t('diag__total', { ms: totalMs }) }}
      span.line(:class="verdictClass") {{ verdictLabel }}
    ol.list
      li(v-for="a in d.attempts" :key="a.seq" :class="rowClass(a)")
        span.idx {{ a.seq }}
        span.source {{ a.source }}
        span.result {{ resultLabel(a) }}
        span.ms {{ a.ms }}ms
        span.limit(v-if="a.limit") /{{ a.limit }}ms
        span.msg(v-if="a.message") {{ a.message }}
      li(v-if="!d.attempts.length" :class="$style.empty") {{ $t('diag__empty') }}
    footer
      button.act(type="button" :aria-label="$t('diag__copy')" @click="handleCopy") {{ copyLabel }}
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { diagnosis } from '@renderer/core/player/diagnosis'
import { buildDiagnosisReport } from '@renderer/core/player/diagnosis'
import { clipboardWriteText } from '@common/utils/electron'

const RESULT_KEY = {
  ok: 'diag__result_ok',
  cache: 'diag__result_cache',
  fail: 'diag__result_fail',
  timeout: 'diag__result_timeout',
  skip: 'diag__result_skip',
}

export default {
  name: 'PlayDiagnosisPanel',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  setup() {
    const copyLabel = ref('')
    const d = diagnosis

    const totalMs = computed(() => {
      if (!d.startedAt) return 0
      return (d.endedAt || Date.now()) - d.startedAt
    })
    const verdictLabel = computed(() => {
      if (!d.verdict) return window.i18n.t('diag__verdict_running')
      return d.verdictText || d.verdict
    })
    const verdictClass = computed(() => ({
      ok: d.verdict == 'ok',
      bad: d.verdict == 'exhausted' || d.verdict == 'audio-failed',
    }))
    const rowClass = (a) => ({
      row: true,
      ok: a.result == 'ok' || a.result == 'cache',
      bad: a.result == 'fail' || a.result == 'timeout',
    })
    const resultLabel = (a) => window.i18n.t(RESULT_KEY[a.result] ?? 'diag__result_fail')

    const handleCopy = () => {
      void clipboardWriteText(buildDiagnosisReport())
      copyLabel.value = window.i18n.t('diag__copied')
      setTimeout(() => { copyLabel.value = '' }, 1500)
    }

    return { d, totalMs, verdictLabel, verdictClass, rowClass, resultLabel, handleCopy, copyLabel }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.diag {
  position: absolute;
  right: 0;
  bottom: 34px;
  z-index: 6;
  width: min(420px, 92vw);
  max-width: 100%;
  max-height: 320px;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-app-background, #16171c) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-font) 18%, transparent);
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 32px rgb(0 0 0 / .42);
  color: var(--detail-font-bright, var(--color-font));
  font-size: 12px;
  text-align: left;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.title { font-weight: 600; font-size: 12px; }
.close {
  display: flex;
  width: 18px;
  height: 18px;
  padding: 2px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: .7;
  cursor: pointer;
  svg { width: 100%; height: 100%; fill: currentColor; }
  &:hover { opacity: 1; }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
}

.meta {
  display: flex;
  flex-flow: column nowrap;
  gap: 2px;
  margin-bottom: 8px;
  opacity: .9;
  .line { .mixin-ellipsis-1(); }
  .ok { color: #67d17a; }
  .bad { color: #ff8080; }
}

.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 2px;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--color-font) 6%, transparent);
  &.ok { border-left: 2px solid #67d17a; }
  &.bad { border-left: 2px solid #ff8080; opacity: .9; }
  .idx { opacity: .5; min-width: 16px; }
  .source { font-weight: 600; min-width: 34px; }
  .result { min-width: 56px; }
  .ms { opacity: .8; }
  .limit { opacity: .5; }
  .msg {
    flex: 1 1 auto;
    min-width: 0;
    opacity: .7;
    .mixin-ellipsis-1();
  }
}
.empty { opacity: .6; padding: 6px; }

footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
.act {
  padding: 4px 12px;
  border: none;
  border-radius: 7px;
  background: var(--color-primary, #4a8cff);
  color: var(--color-primary-font, #fff);
  font-size: 12px;
  cursor: pointer;
  &:hover { filter: brightness(1.08); }
  &:focus-visible { outline: 2px solid var(--color-font); outline-offset: 2px; }
}

.diag-enter-active, .diag-leave-active { transition: opacity .18s ease, transform .18s ease; }
.diag-enter-from, .diag-leave-to { opacity: 0; transform: translateY(6px); }

@media (prefers-reduced-motion: reduce) {
  .diag-enter-active, .diag-leave-active { transition: none; }
}
</style>
